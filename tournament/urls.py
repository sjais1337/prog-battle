from django.urls import path
from .views import (
    TeamListCreateView, 
    TeamDetailView,
    TeamMatchListView,
    BotSubmissionListCreateView,
    BotSubmissionDetailView,
    BotSubmissionSetActiveView,
    InitiateTestMatchView,
    MatchListView,
    MatchDetailView,
    MatchLogView,
    LeaderboardListView,
    ChallengeListCreateView,
    ChallengeDetailView,
    ChallengeAcceptView,
    ChallengeDeclineView,
    ChallengeCancelView,
    RoundTwoBracketView
)

urlpatterns = [
    path('teams/', TeamListCreateView.as_view(), name='team-list-create'),
    path('teams/<uuid:pk>/', TeamDetailView.as_view(), name='team-detail'), 

    path('teams/<uuid:team_pk>/submissions/', BotSubmissionListCreateView.as_view(), name='submission-list-create'),
    path('teams/<uuid:team_pk>/submissions/<uuid:submission_pk>/', BotSubmissionDetailView.as_view(), name='submission-detail'),
    path('teams/<uuid:team_pk>/submissions/<uuid:submission_pk>/set-active/', BotSubmissionSetActiveView.as_view(), name='submission-set-active'),
    path('teams/<uuid:team_pk>/matches/', TeamMatchListView.as_view(), name='team-match-list'),

    path('matches/initiate-test/', InitiateTestMatchView.as_view(), name='match-initiate-test'),
    path('matches/', MatchListView.as_view(), name='match-list'),
    path('matches/<uuid:id>/', MatchDetailView.as_view(), name='match-detail'),
    path('matches/<uuid:match_id>/log/', MatchLogView.as_view(), name='match-log'),
    
    path('leaderboard/', LeaderboardListView.as_view(), name='leaderboard-list'),
    path('round-two-bracket/', RoundTwoBracketView.as_view(), name='round-two-bracket-list'),

    path('challenges/', ChallengeListCreateView.as_view(), name='challenge-list-create'),
    path('challenges/<uuid:pk>/', ChallengeDetailView.as_view(), name='challenge-detail'),
    path('challenges/<uuid:pk>/accept/', ChallengeAcceptView.as_view(), name='challenge-accept'),
    path('challenges/<uuid:pk>/decline/', ChallengeDeclineView.as_view(), name='challenge-decline'),
    path('challenges/<uuid:pk>/cancel/', ChallengeCancelView.as_view(), name='challenge-cancel'),

]