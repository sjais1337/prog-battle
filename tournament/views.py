from rest_framework import generics, permissions, status, views
from .models import (
    Team, 
    BotSubmission, 
    Match, 
    LeaderboardScore,
    Challenge
)
from .serializers import ( 
    TeamSerializer, 
    BotSubmissionSerializer, 
    MatchSerializer, 
    LeaderboardScoreSerializer, 
    ChallengeSerializer
)
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from django.utils import timezone 
from datetime import timedelta
from rest_framework.exceptions import ValidationError, PermissionDenied
from .tasks import process_match_task
from django.http import FileResponse, Http404
from django.db.models import Q
from django.db import transaction

class IsTeamCreator(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):

        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.creator == request.user
    
class TeamListCreateView(generics.ListCreateAPIView):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

class TeamMatchListView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        team_pk = self.kwargs['team_pk'] 
        target_team = get_object_or_404(Team, pk=team_pk)
        user = self.request.user

        is_member_or_creator = False
        if user.is_authenticated:
            if target_team.members.filter(pk=user.pk).exists() or target_team.creator == user:
                is_member_or_creator = True
        
        base_query = Match.objects.filter(
            Q(player1_submission__team=target_team) | 
            Q(player2_submission__team=target_team)
        ).select_related(
            'player1_submission__team', 
            'player2_submission__team',
            'winning_team'
        ).distinct()

        if is_member_or_creator:
            return base_query.order_by('-created_at')
        else:
            return base_query.filter(
                status=Match.MatchStatus.COMPLETED
            ).exclude(
                match_type=Match.MatchType.TEST_VS_SYSTEM
            ).order_by('-created_at')

class TeamDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer

    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

class BotSubmissionListCreateView(generics.ListCreateAPIView):
    serializer_class = BotSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    HOURLY_SUBMISSION_LIMIT = 5
    DAILY_SUBMISSION_LIMIT = 20

    def get_queryset(self):
        team_pk = self.kwargs['team_pk']
        team = get_object_or_404(Team, pk=team_pk)

        return BotSubmission.objects.filter(team=team).order_by('-submitted_at')
    
    def perform_create(self, serializer):
        team_pk = self.kwargs['team_pk']
        team = get_object_or_404(Team, pk=team_pk)

        if not team.members.filter(pk=self.request.user.pk).exists():
            raise PermissionDenied("User not a mmeber of the team.")
    
        one_hour_ago = timezone.now() - timedelta(hours=1)

        recent_submission_count = BotSubmission.objects.filter(
            team = team,
            submitted_at__gte = one_hour_ago
        ).count()

        if recent_submission_count >= self.HOURLY_SUBMISSION_LIMIT:
            raise ValidationError(
                {'detail': f"Team hourly submission limit of {self.HOURLY_SUBMISSION_LIMIT} reached. Please try again later."}
            )

        serializer.save(team=team, submitted_by=self.request.user)

class BotSubmissionDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = BotSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        team_pk = self.kwargs['team_pk']
        return BotSubmission.objects.filter(team_id=team_pk)
    
    def get_object(self):
        queryset = self.get_queryset()
        obj = get_object_or_404(queryset, pk=self.kwargs['submission_pk'])

        team = obj.team

        if not team.members.filter(pk=self.request.user.pk).exists():
            raise PermissionDenied("User not member of the team.")
        
        return obj
    
class BotSubmissionSetActiveView(generics.UpdateAPIView):
    serializer_class = BotSubmissionSerializer
    permission_classes = [ permissions.IsAuthenticated ]

    queryset = BotSubmission.objects.all()

    def get_object(self):
        team_pk = self.kwargs['team_pk']
        submission_pk = self.kwargs['submission_pk']

        submission = get_object_or_404(BotSubmission, pk=submission_pk, team_id=team_pk)

        team = submission.team

        if not team.members.filter(pk = self.request.user.pk).exists():
            raise PermissionDenied("User not member of the team.")
        
        return submission
    
    def update(self, reuest, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = True
        instance.save()
        serializer = self.get_serializer(instance)

        return Response(serializer.data)

class InitiateTestMatchView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MatchSerializer

    HOURLY_TEST_MATCH_LIMIT_PER_TEAM = 100

    def post(self, request, *args, **kwargs):
        user = request.user

        team = Team.objects.filter(members=user).first()
        if not team:
            return Response(
                {"detail": "You are not part of any team."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        active_submission = BotSubmission.objects.filter(team=team, is_active=True).first()

        if not active_submission:
            return Response(
                {"detail": f"No active bot submission found for team {team.name}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        one_hour_ago = timezone.now() - timedelta(hours=1)

        recent_test_matches_count = Match.objects.filter(
            match_type=Match.MatchType.TEST_VS_SYSTEM,
            player1_submission__team=team,
            created_at__gte=one_hour_ago
        ).count()

        if recent_test_matches_count >= self.HOURLY_TEST_MATCH_LIMIT_PER_TEAM:
            return Response(
                {"detail": f"Team hourly test match limit of {self.HOURLY_TEST_MATCH_LIMIT_PER_TEAM}"},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
    
        match = Match.objects.create(
            match_type=Match.MatchType.TEST_VS_SYSTEM,
            player1_submission=active_submission,
            is_player2_system_bot=True,
            status=Match.MatchStatus.PENDING
        )

        process_match_task.delay(match.id.hex)

        serializer = self.serializer_class(match)

        return Response(serializer.data, status=status.HTTP_201_CREATED)

class MatchListView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_teams = Team.objects.filter(Q(members=user))

        if not user_teams.exists():
            return Match.objects.none()
        
        team_submissions = BotSubmission.objects.filter(team__in=user_teams)

        queryset = Match.objects.filter(
            Q(player1_submission__in=team_submissions) |
            Q(player2_submission__in=team_submissions)
        ).select_related(
            'player1_submission__team',
            'player2_submission__team',
            'winning_team'
        ).distinct().order_by('-created_at')

        return queryset

class MatchDetailView(generics.RetrieveAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    queryset = Match.objects.all().select_related(
        'player1_submission__team',
        'player2_submission__team',
        'winning_team'
    )

    lookup_field = 'id'

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        user_teams = Team.objects.filter(Q(members=user))

        # is_involved = False
        # if obj.player1_submission and obj.player1_submission.team in user_teams:
        #     is_involved = True
        # if obj.player2_submission and obj.player2_submission.team in user_teams:
        #     is_involved = True

        # if not is_involved and not user.is_staff:
        #     raise Http404("You do not have permission to view this match.")
        
        return obj


class MatchLogView(views.APIView):
    permission_classes = [ permissions.IsAuthenticated ]

    def get(self, request, match_id):
        match = get_object_or_404(Match, id=match_id)

        user = request.user

        user_teams = Team.objects.filter(Q(members=user))
        is_involved = False

        if match.player1_submission and match.player1_submission.team in user_teams:
            is_involved = True
        if match.player2_submission and match.player2_submission.team in user_teams:
            is_involved = True

        if not is_involved and not user.is_staff:
            return Response({"detail": "Not authorized to view this log."}, status=status.HTTP_403_FORBIDDEN)

        if not match.game_log_url:
            return Response({"detail": "Game log not available for this match."}, status=status.HTTP_404_NOT_FOUND)

        try:
            response = FileResponse(match.game_log.open('rb'), as_attachment=True)
            return response
        except FileNotFoundError:
            return Response({"detail": "Game long file not found on server."}, status=status.HTTP_404_NOT_FOUND) 
        except Exception as e:
            print(f"Error fetching game log: {e}")
            return Response({"detail": "Error fetching game log"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
class LeaderboardListView(generics.ListAPIView):
    queryset = LeaderboardScore.objects.all().order_by('-score', '-matches_won','matches_played')
    serializer_class = LeaderboardScoreSerializer
    permission_classes = [permissions.AllowAny]


class ChallengeListCreateView(generics.ListCreateAPIView):
    serializer_class = ChallengeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        user_teams = Team.objects.filter(
            Q(creator=user) | Q(members=user)
        ).distinct()

        if not user_teams.exists():
            return Challenge.objects.none()
        
        return Challenge.objects.filter(
            Q(challenger_team__in=user_teams) | Q(challenged_team__in=user_teams)
        ).select_related('challenger_team','challenged_team').order_by('-created_at')
    
    def perform_create(self, serializer):
        user = self.request.user

        challenger_team = Team.objects.filter(
            Q(creator=user) | Q(members=user)
        ).first()

        if not challenger_team:
            raise ValidationError("You must be part of a team to issue a challenge.")
        
        serializer.save(challenger_team=challenger_team)

class ChallengeDetailView(generics.RetrieveAPIView):
    serializer_class = ChallengeSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Challenge.objects.all().select_related('challenger_team','challenged_team','match_played')
    lookup_field = 'id'

    def get_object(self):
        obj = super().get_object()

        user = self.request.user

        user_teams = Team.objects.filter(
            Q(creator=user) | Q(members=user)
        ).distinct()

        if not (obj.challenger_team in user_team or obj.challenged_team in user_teams) and not user.is_staff:
            raise PermissionDenied("You do not have permission to view this challenge.")
        
        return obj
    
class ChallengeAcceptView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChallengeSerializer

    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk)
        user = request.user

        if not challenge.challenged_team.members.filter(pk=user.pk).exists():
            return Response(
                {"detail": "You do not have permission to accept this challenge."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if challenge.status != Challenge.ChallengeStatus.PENDING:
            return Response(
                {"detail":f"This challenge is not pending."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        challenger_submission = BotSubmission.objects.filter(team=challenge.challenger_team, is_active=True).first()
        challenged_submission = BotSubmission.objects.filter(team=challenge.challenger_team, is_active=True).first()

        if not challenger_submission:
            return Response(
                {"detail":f"Challenger team does not have an active bot."},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not challenged_submission:
            return Response(
                {"detail":"Your team does not have an active bot."}
            )
        
        try:
            with transaction.atomic():
                match=Match.objects.create(
                    match_type=Match.MatchType.CHALLENGE,
                    player1_submission=challenger_submission,
                    player2_submission=challenged_submission,
                    is_player2_system_bot=False,
                    status=Match.MatchStatus.PENDING
                )

                challenge.status = Challenge.ChallengeStatus.ACCEPTED

                challenge.resolved_at = timezone.now()
                challenge.match_played = match
                challenge.save()

                process_match_task.delay(match.id.hex)

                serializer = self.serializer_class(challenge)
                return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            print(e)
            return Response(
                {"detail":"An error occurred while creating the match."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
class ChallengeDeclineView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChallengeSerializer

    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk)
        user = request.user

        if not challenge.challenged_team.members.filter(pk=user.pk).exists():
            return Response(
                {"detail":"You do not have permission to decline this challenge."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        challenge.status = Challenge.ChallengeStatus.DECLINED
        challenge.resolved_at = timezone.now()
        challenge.save(update_fields=['status','resolved_at'])

        serializer = self.serializer_class(challenge)
        
        return Response(serializer.data, status=status.HTTP_200_OK)

class ChallengeCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ChallengeSerializer

    def post(self, request, pk):
        challenge = get_object_or_404(Challenge, pk=pk)
        user = request.user

        if not challenge.challenger_team.members.filter(pk=user.pk).exists():
            return Response(
                {"detail":"You do not have permission to cancel this challenge"},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if challenge.status != Challenge.ChallengeStatus.PENDING:
            return Response(
                {"detail":"This challenge is not pending and cannot be cancelled."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        challenge.status = Challenge.ChallengeStatus.CANCELLED
        challenge.resolved_at = timezone.now()
        challenge.save(update_fields=['status','resolved_at'])

        serializer = self.serializer_class(challenge)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RoundTwoBracketView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.AllowAny] 

    def get_queryset(self):
        return Match.objects.filter(
            match_type=Match.MatchType.ROUND_TWO
        ).select_related(
            'player1_submission__team',
            'player2_submission__team',
            'winning_team'
        ).order_by('round_stage', 'created_at') 