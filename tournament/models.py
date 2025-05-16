from django.db import models 
from django.conf import settings
from django.core.exceptions import ValidationError
import uuid

User = settings.AUTH_USER_MODEL

class Team(models.Model):
    name = models.CharField(max_length=100, unique=True, help_text="The official name of the team.")
    creator = models.ForeignKey(User, related_name='created_teams',on_delete=models.CASCADE, help_text="The user who created the team.")
    members = models.ManyToManyField(User, related_name='members_of_team', blank=True, help_text='Members of the team.')
    created_at = models.DateTimeField(auto_now_add=True)


    def __str__(self):
        return self.name

    def clean(self):
        pass

    def save(self, *args, **kwargs):
        is_new_team = self.pk is None

        super().save(*args, **kwargs)

        if is_new_team:
            self.members.add(self.creator)
        
class BotSubmission(models.Model):
    team = models.ForeignKey(Team, related_name='submissions', on_delete=models.CASCADE)
    submitted_by = models.ForeignKey(User, related_name='bot_submissions', on_delete=models.CASCADE)
    code_file = models.FileField(upload_to='bot_scripts/', help_text="The Python (.py) file for the bot.")
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=False, help_text="Is this the currently active bot for the team in official matches?")
    plagiarism_flagged = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.team.name} - Bot Submission {self.id} ({'Active' if self.is_active else 'Inactive'})"

    def save(self, *args, **kwargs):
        if self.is_active:
            BotSubmission.objects.filter(team=self.team).exclude(pk=self.pk).update(is_active=False)

        super().save(*args, **kwargs)

class Match(models.Model):
    class MatchType(models.TextChoices):
        TEST_VS_SYSTEM = 'TS', 'Test vs System Bot'
        ROUND_ONE = 'R1', 'Round One (vs System)'
        ROUND_TWO = 'R2', 'Round Two (Team vs Team)'
        CHALLENGE = 'CH', 'Challenge Match'

    class MatchStatus(models.TextChoices):
        PENDING = 'P', 'Pending'
        RUNNING = 'R', 'Running'
        COMPLETED = 'C', 'Completed'
        ERROR = 'E', 'Error'

    match_type = models.CharField(max_length=2, choices=MatchType.choices)
    status = models.CharField(max_length=1, choices=MatchStatus.choices, default=MatchStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    played_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when the match was actually played.")

    # Participants - can be a team's bot vs another team's bot, or a team's bot vs a system bot
    player1_submission = models.ForeignKey(BotSubmission, related_name='matches_as_player1', on_delete=models.SET_NULL, null=True, blank=True)
    player2_submission = models.ForeignKey(BotSubmission, related_name='matches_as_player2', on_delete=models.SET_NULL, null=True, blank=True)
    # If player2 is a system bot (e.g. in Round 1 or Test matches)
    is_player2_system_bot = models.BooleanField(default=False, help_text="True if player2 is the constant system bot.")
    
    # Scores
    player1_score = models.IntegerField(null=True, blank=True)
    player2_score = models.IntegerField(null=True, blank=True) # This would be system_bot_opponent's score if it's playing

    # Winner - can be a team (derived from submission) or null if draw/error
    winning_team = models.ForeignKey(Team, related_name='matches_won', on_delete=models.SET_NULL, null=True, blank=True)
    
    game_log = models.FileField(upload_to='game_logs/', null=True, blank=True, help_text="CSV log file from engine.py.")

    def __str__(self):
        p1_name = self.player1_submission.team.name if self.player1_submission else "Player 1 N/A"
        p2_name = ""
        if self.is_player2_system_bot:
            p2_name = "System Bot"
        elif self.player2_submission:
            p2_name = self.player2_submission.team.name
        else:
            p2_name = "Player 2 N/A"
        return f"Match {self.id}: {p1_name} vs {p2_name} ({self.get_match_type_display()})"

    def clean(self):
        super().clean() # Call parent's clean method

        if self.match_type in [self.MatchType.ROUND_ONE, self.MatchType.TEST_VS_SYSTEM]:
            if not self.player1_submission:
                raise ValidationError("Round 1/Test matches require player1's submission.")
            if self.player2_submission:
                raise ValidationError("Player 2 submission should not be set for matches against the system bot in Round 1/Test.")
            # Ensure is_player2_system_bot is true for these match types
            if not self.is_player2_system_bot:
                 raise ValidationError("is_player2_system_bot must be true for Round 1/Test matches.")
        elif self.match_type in [self.MatchType.ROUND_TWO, self.MatchType.CHALLENGE]:
            if not self.player1_submission or not self.player2_submission:
                raise ValidationError("Round 2/Challenge matches require two team submissions.")
            if self.is_player2_system_bot:
                raise ValidationError("System bot cannot be player 2 in Round 2/Challenge matches.")
            if self.player1_submission.team == self.player2_submission.team:
                 raise ValidationError("A team cannot play against itself in official matches/challenges.")
        else: # Should not happen if choices are enforced
            if self.is_player2_system_bot and self.player2_submission:
                raise ValidationError("Cannot have both player2_submission and is_player2_system_bot for a generic match.")

    def save(self, *args, **kwargs):
        # Automatically set is_player2_system_bot for relevant match types if not already set
        if self.match_type in [self.MatchType.ROUND_ONE, self.MatchType.TEST_VS_SYSTEM]:
            self.is_player2_system_bot = True
            self.player2_submission = None # Ensure no player2 bot if system bot is playing
        elif self.match_type in [self.MatchType.ROUND_TWO, self.MatchType.CHALLENGE]:
            self.is_player2_system_bot = False

        super().save(*args, **kwargs)

class LeaderboardScore(models.Model):
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name='leaderboard_entries')
    score = models.IntegerField(default=0, help_text="Overall score for leaderboard, calculated based on match results.")
    rank = models.PositiveIntegerField(null=True, blank=True, help_text="Team's rank on the leaderboard.")
    matches_played = models.PositiveIntegerField(default=0)
    matches_won = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-score', 'rank']
        unique_together = ('team',) # Assuming one leaderboard entry per team globally

    def __str__(self):
        return f"{self.team.name} - Score: {self.score}"


class Challenge(models.Model):
    class ChallengeStatus(models.TextChoices):
        PENDING = 'P', 'Pending'
        ACCEPTED = 'A', 'Accepted'
        DECLINED = 'D', 'Declined'
        COMPLETED = 'C', 'Completed'
        CANCELLED = 'X', 'Cancelled'

    challenger_team = models.ForeignKey(Team, related_name='sent_challenges', on_delete=models.CASCADE)
    challenged_team = models.ForeignKey(Team, related_name='received_challenges', on_delete=models.CASCADE)
    status = models.CharField(max_length=1, choices=ChallengeStatus.choices, default=ChallengeStatus.PENDING)
    message = models.TextField(blank=True, null=True, help_text="Optional message from the challenger.")
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    match_played = models.OneToOneField(Match, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Challenge: {self.challenger_team.name} vs {self.challenged_team.name} ({self.get_status_display()})"

    def clean(self):
        if self.challenger_team == self.challenged_team:
            raise ValidationError("A team cannot challenge itself.")
