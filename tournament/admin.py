from django.contrib import admin
from .models import Team, BotSubmission, Match, LeaderboardScore, Challenge

admin.site.register(Team)
admin.site.register(BotSubmission)
admin.site.register(Match)
admin.site.register(LeaderboardScore)
admin.site.register(Challenge)