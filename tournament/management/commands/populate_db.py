import os
import random
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.db import transaction
from django.conf import settings
from django.core.files import File

from tournament.models import Team, BotSubmission, Match, LeaderboardScore, Challenge

User = get_user_model()

SAMPLE_BOTS = os.path.join(settings.BASE_DIR, 'tests')

class Command(BaseCommand):

    def add_arguments(self, parser):
        parser.add_argument(
            '--num_teams',
            type=int,
            default=24
        )
        parser.add_argument(
            '--password',
            type=str,
            default='password123',
        )
        parser.add_argument(
            '--clear',
            action='store_true'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        num_teams = options['num_teams']
        password = options['password']
        clear_data = options['clear']

        files = [f for f in os.listdir(SAMPLE_BOTS) if f.endswith('.py')]

        if clear_data:
            Challenge.objects.all().delete()
            LeaderboardScore.objects.all().delete()
            Match.objects.all().delete()
            BotSubmission.objects.all().delete()
            Team.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()
            self.stdout.write('Data cleared.')

        created_users_count = 0
        created_teams_count = 0
        created_submissions_count = 0

        for i in range(num_teams):
            username = f'user{i+1}'
            email = f'user{i+1}@gmail.com'

            if User.objects.filter(username=username).exists():
                user = User.objects.get(username=username)
                pass
            else:
                try:
                    user = User.objects.create_user(username=username, email=email, password=password)
                    user.is_active = True
                    user.save()
                    created_users_count += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Error creating user {username}: {e}"))
                    continue
            
            team_name = f'Team {username.capitalize()}'
            if Team.objects.filter(name=team_name).exists():
                team = Team.objects.get(name=team_name)
                pass
            else:
                try:
                    team = Team.objects.create(name=team_name, creator=user)
                    created_teams_count += 1
                except Exception as e:
                    continue
            
            if team:
                try:
                    bot_script_name = random.choice(files)
                    bot_script_path = os.path.join(SAMPLE_BOTS, bot_script_name)
                    
                    submission = BotSubmission(team=team, submitted_by=user, is_active=True)

                    with open(bot_script_path, 'rb') as f:
                        file = File(f, name=os.path.basename(bot_script_path))
                        submission.code_file.save(file.name, file, save=True)

                    created_submissions_count += 1
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Error creating bot submission for {team.name}: {e}"))
                    pass
        
