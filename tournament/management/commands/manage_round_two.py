from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from tournament.models import Match, LeaderboardScore
from tournament.tasks import process_match_task

class Command(BaseCommand):
    help = 'Manages round 2 progression'

    def add_arguments(self, parser):
        parser.add_argument(
            '--stage_teams',
            type=int,
            required=True,
            help='The number of teams that should be in the stage.',
        )
        parser.add_argument(
            '--initial_qualifiers_count',
            type=int,
            default=16, 
            help='Total number of teams that qualified for Round 2.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        stage_to_setup_teams = options['stage_teams']
        initial_qualifiers_count = options['initial_qualifiers_count']

        if not (stage_to_setup_teams > 0 and (stage_to_setup_teams & (stage_to_setup_teams - 1) == 0)) or stage_to_setup_teams < 2:
            raise CommandError(f"--stage_teams ({stage_to_setup_teams}) must be a positive power of 2.")
        if not (initial_qualifiers_count > 0 and (initial_qualifiers_count & (initial_qualifiers_count - 1) == 0)):
            raise CommandError(f"--initial_qualifiers_count ({initial_qualifiers_count}) must be a positive power of 2.")
        if stage_to_setup_teams > initial_qualifiers_count:
            raise CommandError(f"--stage_teams ({stage_to_setup_teams}) cannot be greater than --initial_qualifiers_count ({initial_qualifiers_count}).")

        self.stdout.write(self.style.NOTICE(f"Setting up Round 2 - Stage of {stage_to_setup_teams}..."))

        existing_future_matches = Match.objects.filter(
            match_type=Match.MatchType.ROUND_TWO,
            round_stage__lte=stage_to_setup_teams, 
            status__in=[Match.MatchStatus.PENDING, Match.MatchStatus.RUNNING]
        )
        if existing_future_matches.exists():
            self.stdout.write(self.style.WARNING(
                f"Found {existing_future_matches.count()} PENDING or RUNNING Round 2 matches. "
                "Cannot create new matches until existing ones have been completed."
            ))
            return

        qualifying_teams_data = [] 

        if stage_to_setup_teams == initial_qualifiers_count:
            self.stdout.write(f"Setting up initial Round 2 stage with {initial_qualifiers_count} teams from Round 1 Leaderboard.")
            
            completed_matches_for_this_stage = Match.objects.filter(
                match_type=Match.MatchType.ROUND_TWO,
                round_stage=initial_qualifiers_count,
                status=Match.MatchStatus.COMPLETED
            ).count()
            if completed_matches_for_this_stage == initial_qualifiers_count / 2:
                self.stdout.write(self.style.NOTICE(f"Initial stage Top {initial_qualifiers_count} already decided. To advance, run with --stage={initial_qualifiers_count // 2}."))
                return


            top_leaderboard_entries = LeaderboardScore.objects.order_by('-score', 'matches_played', 'last_updated')[:initial_qualifiers_count]
            
            if len(top_leaderboard_entries) < initial_qualifiers_count:
                raise CommandError(f"Not enough teams ({len(top_leaderboard_entries)}) on Round 1 leaderboard for {initial_qualifiers_count} qualifiers.")

            for entry in top_leaderboard_entries:
                active_submission = entry.team.submissions.filter(is_active=True).first()
                if active_submission:
                    qualifying_teams_data.append({'team': entry.team, 'submission': active_submission, 'seed_score': entry.score})
                else:
                    self.stderr.write(self.style.ERROR(f"Team {entry.team.name} qualified but has no active bot. They will be skipped for Round 2 match generation."))
            
            if len(qualifying_teams_data) < stage_to_setup_teams:
                 self.stdout.write(self.style.WARNING(f"Warning: Only {len(qualifying_teams_data)} teams have active bots out of {initial_qualifiers_count} initial qualifiers."))

        else: 
            previous_stage_size = stage_to_setup_teams * 2
            self.stdout.write(f"Setting up stage Top {stage_to_setup_teams} by collecting winners from stage Top {previous_stage_size}.")

            completed_matches_previous_stage = Match.objects.filter(
                match_type=Match.MatchType.ROUND_TWO,
                status=Match.MatchStatus.COMPLETED,
                round_stage=previous_stage_size
            )

            if completed_matches_previous_stage.count() != previous_stage_size / 2:
                raise CommandError(
                    f"Previous stage (Top {previous_stage_size}) is not fully completed. "
                    f"Expected {previous_stage_size / 2} completed matches, found {completed_matches_previous_stage.count()}."
                )

            for match_obj in completed_matches_previous_stage:
                if match_obj.winning_team:
                    active_submission = match_obj.winning_team.submissions.filter(is_active=True).first()
                    if active_submission:
                        lb_entry = LeaderboardScore.objects.filter(team=match_obj.winning_team).first()
                        seed_score = lb_entry.score if lb_entry else 0
                        qualifying_teams_data.append({'team': match_obj.winning_team, 'submission': active_submission, 'seed_score': seed_score})
                    else:
                        self.stderr.write(self.style.ERROR(f"Team {match_obj.winning_team.name} won their previous match but now has no active bot. They cannot advance."))
                else:
                    raise CommandError(f"Match {match_obj.id.hex} in stage Top {previous_stage_size} completed without a recorded winner. Cannot advance bracket.")
            
            if len(qualifying_teams_data) != stage_to_setup_teams:
                raise CommandError(f"Expected {stage_to_setup_teams} winners with active bots from stage Top {previous_stage_size}, but found {len(qualifying_teams_data)}. Cannot generate next stage.")


        if not qualifying_teams_data:
            self.stdout.write(self.style.WARNING("No qualifying teams found for this stage."))
            return
            
        if len(qualifying_teams_data) == 1 and stage_to_setup_teams == 2: 
             self.stdout.write(self.style.SUCCESS(f"Tournament Winner by default/walkover: {qualifying_teams_data[0]['team'].name}!"))
             return
        elif len(qualifying_teams_data) == 1 and stage_to_setup_teams != 2:
             self.stdout.write(self.style.ERROR(f"Only one team ({qualifying_teams_data[0]['team'].name}) advanced to stage Top {stage_to_setup_teams}, but it's not the final. Check bracket logic or previous round results."))
             return


        if len(qualifying_teams_data) < 2 :
            self.stdout.write(self.style.WARNING("Not enough teams to form any pairs for this stage."))
            return

        qualifying_teams_data.sort(key=lambda x: x['seed_score'], reverse=True)

        matches_to_create_this_stage = len(qualifying_teams_data) // 2
        if len(qualifying_teams_data) % 2 != 0:
            self.stdout.write(self.style.WARNING(f"Odd number of teams ({len(qualifying_teams_data)}) for stage Top {stage_to_setup_teams}. Last team ({qualifying_teams_data[-1]['team'].name}) gets a BYE (auto-advances). Bye logic not fully implemented here."))

        self.stdout.write(f"Pairing {matches_to_create_this_stage * 2} teams for {matches_to_create_this_stage} matches in stage Top {stage_to_setup_teams}...")
        
        matches_created_count = 0
        for i in range(matches_to_create_this_stage):
            team1_data = qualifying_teams_data[i] 
            team2_data = qualifying_teams_data[len(qualifying_teams_data) - 1 - i - (len(qualifying_teams_data) % 2)]

            if team1_data['team'] == team2_data['team']: 
                self.stderr.write(self.style.ERROR("Critical error: Tried to pair a team with itself."))
                continue 

            if Match.objects.filter(
                Q(player1_submission=team1_data['submission'], player2_submission=team2_data['submission']) |
                Q(player1_submission=team2_data['submission'], player2_submission=team1_data['submission']),
                match_type=Match.MatchType.ROUND_TWO,
                round_stage=stage_to_setup_teams,
                status__in=[Match.MatchStatus.PENDING, Match.MatchStatus.RUNNING, Match.MatchStatus.COMPLETED] 
            ).exists():
                self.stdout.write(self.style.WARNING(f"Match for {team1_data['team'].name} vs {team2_data['team'].name} in stage Top {stage_to_setup_teams} already exists. Skipping."))
                continue

            try:
                match = Match.objects.create(
                    match_type=Match.MatchType.ROUND_TWO,
                    round_stage=stage_to_setup_teams,
                    player1_submission=team1_data['submission'],
                    player2_submission=team2_data['submission'],
                    is_player2_system_bot=False,
                    status=Match.MatchStatus.PENDING
                )

                id_hex_for_this_iteration = match.id.hex

                transaction.on_commit(
                    lambda captured_hex=id_hex_for_this_iteration: process_match_task.delay(captured_hex)
                )
                matches_created_count += 1
                self.stdout.write(self.style.SUCCESS(
                    f"  Created & Queued Stage Top {stage_to_setup_teams} Match: {team1_data['team'].name} vs {team2_data['team'].name} (ID: {match.id.hex})"
                ))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"  Error creating match between {team1_data['team'].name} and {team2_data['team'].name}: {e}"))

        if matches_created_count > 0:
            self.stdout.write(self.style.SUCCESS(f"Successfully created and queued {matches_created_count} matches for Round 2 - Stage Top {stage_to_setup_teams}."))
        else:
            self.stdout.write(self.style.WARNING(f"No new matches were created for Round 2 - Stage Top {stage_to_setup_teams}."))