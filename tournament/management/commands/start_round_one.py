from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from tournament.models import Team, Match
from tournament.tasks import process_match_task
import time

class Command(BaseCommand):
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--games_per_team',
            type=int,
            default=3,
            help='Number of Round 1 games to creater per team.'
        )

    @transaction.atomic
    def handle(self, *args, **kwargs):
        games_per_team = kwargs['games_per_team']

        if games_per_team <= 0:
            raise CommandError('Number of games must be positive.')
        
        self.stdout.write(self.style.NOTICE(f"Starting Round 1"))

        teams = Team.objects.filter(
            submissions__is_active=True
        ).distinct()

        if not teams:
            self.stdout.write(self.style.WARNING('No teams with active bots.'))
            return

        matches_created = 0

        for team in teams:
            submission = team.submissions.filter(is_active=True).first()

            for i in range(games_per_team):
                try: 
                    match = Match.objects.create(
                        match_type=Match.MatchType.ROUND_ONE,
                        player1_submission=submission,
                        is_player2_system_bot=True,
                        status=Match.MatchStatus.PENDING
                    )

                    id_hex_for_this_iteration = match.id.hex

                    transaction.on_commit(
                        lambda captured_id_hex=id_hex_for_this_iteration: process_match_task.delay(captured_id_hex)
                    )
                    
                    
                    matches_created += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Error creating match for team {team.name} : {e}"))

        if matches_created > 0:
            self.stdout.write(self.style.SUCCESS(f"Successfully created {matches_created} Round 1 matches."))
        else:
            self.stdout.write(self.style.WARNING("No new Round 1 matches were created."))
           


