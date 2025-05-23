import subprocess
import os
import shutil
import re
import json
import uuid
from celery import shared_task
from django.conf import settings
from django.core.files import File
from django.utils import timezone
from django.db.models import F

from .models import Match, Team, LeaderboardScore

ENGINE_PATH = os.path.join(settings.BASE_DIR, 'engine.py')
SYSTEM_BOT = os.path.join(settings.BASE_DIR, 'bot1.py')

@shared_task
def process_match_task(match_id):
    try:
        match_uuid = uuid.UUID(match_id)
        match = Match.objects.get(id=match_uuid)
    except Match.DoesNotExist:
        print(f"Match with id {match_id} not found.")
        return f"Match with id {match_id} not found."
    
    if match.status != Match.MatchStatus.PENDING:
        print(f"Match is not pending, current status: {match.status}")
        return "Match not pending."
    
    print(f"Processing match {match_id}...")
    match.status = Match.MatchStatus.RUNNING
    match.save(update_fields=['status'])

    player1_bot_path = None
    player2_bot_path = None

    log_file_name = f"game_log_{match.id.hex}"

    if match.player1_submission and match.player1_submission.code_file:
        player1_bot_path = match.player1_submission.code_file.path
    else:
        match.status = Match.MatchStatus.ERROR
        match.save(update_fields=['status'])
        return F"Error: Player 1 bot script not found."

    if match.is_player2_system_bot:
        player2_bot_path = SYSTEM_BOT
    elif match.player1_submission and match.player2_submission.code_file:
        player2_bot_path = match.player2_submission.code_file.path
    else:
        match.status = Match.MatchStatus.ERROR
        match.save(update_fields=['status'])
        return F"Error: Player 2 bot script not found."

    temp_match_dir = os.path.join(settings.MEDIA_ROOT, 'temp_match_logs', str(match.id.hex))
    os.makedirs(temp_match_dir, exist_ok=True)
    log = os.path.join(temp_match_dir, 'game_log.csv')

    out_file = os.path.join(settings.MEDIA_ROOT, 'temp_match_logs', str(match.id.hex), 'game_log.csv')

    command = [
        'python3',
        ENGINE_PATH,
        '--p1', player1_bot_path,
        '--p2', player2_bot_path,
        '--out_dir', out_file
    ]

    try: 
        process = subprocess.run(command, capture_output=True, text=True, timeout=3)


        engine_stderr_capture = process.stderr.strip() if process.stderr else ""

        if engine_stderr_capture:
            print(f"Match {match.id.hex}: Engine STDERR:\n{engine_stderr_capture}")


        score_p1 = None
        score_p2 = None

        data = json.loads(process.stdout.strip())
        score_p1 = data.get('player1_score')
        score_p2 = data.get('player2_score')

        match.player1_score = score_p1
        match.player2_score = score_p2

        with open(log, 'rb') as log_f:
            match.game_log.save(log_file_name, File(log_f), save=False)

        match.status = Match.MatchStatus.COMPLETED

        if score_p1 > score_p2:
            match.winning_team = match.player1_submission.team
        elif score_p2 > score_p1:
            if not match.is_player2_system_bot:
                match.winning_team = match.player2_submission.team
        else:
            pass
    except subprocess.TimeoutExpired:
        print(f"Match {match.id.hex}: Engine.py timed out after 10 seconds.")
        match.status = Match.MatchStatus.COMPLETED 
        match.player1_score = 1 
        match.player2_score = 0 
        match.winning_team = match.player1_submission.team 
        if os.path.exists(log):
            with open(log, 'rb') as log_f:
                match.game_log.save(log_file_name, File(log_f), save=False)
            print(f"Saved (potentially partial) game log for timed-out match {match.id.hex}")
        else:
            print(f"No game log found for timed-out match {match.id.hex}")
    except Exception as e:
        print(f"An unexpected error occurred while processing match {match_id}: {e}")
        match.status = Match.MatchStatus.ERROR
    finally:
        match.played_at = timezone.now()
        match.save()

        # shutil.rmtree(temp_match_dir)

        if match.status == Match.MatchStatus.COMPLETED and match.match_type == Match.MatchType.ROUND_ONE:
            
            if match.player1_submission and match.player1_submission.team:
                to_update = match.player1_submission.team
                score = match.player1_score if match.player1_score is not None else 0

                leaederboard_entry, created = LeaderboardScore.objects.get_or_create(team=to_update)

                updates = {
                    'score': F('score') + score,
                    'matches_played': F('matches_played') + 1,
                    'last_updated': timezone.now()
                }

                if match.winning_team == to_update:
                    updates['matches_won'] = F('matches_won') + 1

                LeaderboardScore.objects.filter(pk=leaederboard_entry.pk).update(**updates)