from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Team, BotSubmission, Match, LeaderboardScore, Challenge
from django.db.models import Q
import os
from django.core.files.base import ContentFile

User = get_user_model()

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class TeamSerializer(serializers.ModelSerializer):
    creator = serializers.StringRelatedField(read_only=True)
    members_details = serializers.StringRelatedField(source='members', many=True, read_only=True) # Renamed for clarity from 'members'

    member_usernames = serializers.ListField(
        child=serializers.CharField(max_length=150),
        write_only=True,
        required=False,
        help_text="List of usernames for additional team members (max 3)."
    )

    class Meta:
        model = Team
        fields = (
            'id', 
            'name', 
            'creator',      
            'members_details', 
            'member_usernames',
            'created_at'
        )
        read_only_fields = ('created_at',) 
    def validate(self, data):
        
        member_usernames_input = data.get('member_usernames', [])
        unique_member_usernames = set(username.strip() for username in member_usernames_input if username.strip())

        request = self.context.get('request')
        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError("Context error: Request user not found for validation.")
        
        if not self.instance:  
            if Team.objects.filter(creator=request.user).exists():
                raise serializers.ValidationError({
                    "detail": "You have already created a team. Users can only create one team."
                })

        creator_user = None
        if self.instance: 
            creator_user = self.instance.creator
        elif request: 
            creator_user = request.user

        if not creator_user:
             raise serializers.ValidationError("Creator context is missing.")


        resolved_additional_members = []
        for username in unique_member_usernames:
            if username == creator_user.username: 
                continue 
            try:
                user_to_add = User.objects.get(username=username)
                resolved_additional_members.append(user_to_add)
            except User.DoesNotExist:
                raise serializers.ValidationError(f"User with username '{username}' does not exist.")
        
        if len(resolved_additional_members) > 3:
            raise serializers.ValidationError("You can add a maximum of 3 additional members to the team (total 4 including creator).")

        data['resolved_additional_members'] = resolved_additional_members 
        return data

    def create(self, validated_data):
        creator = validated_data.pop('creator')
        member_usernames_data = validated_data.pop('member_usernames', [])
        resolved_additional_members = validated_data.pop('resolved_additional_members', []) 

        team = Team.objects.create(creator=creator, **validated_data)
        
        for member_to_add in resolved_additional_members:
            team.members.add(member_to_add) 
                                           
        return team

    def update(self, instance, validated_data):
        member_usernames_data = validated_data.pop('member_usernames', None)
        resolved_additional_members = validated_data.pop('resolved_additional_members', None)

        instance.name = validated_data.get('name', instance.name)
        instance.save() 

        if resolved_additional_members is not None: 
            members_to_set = {instance.creator}
            for user_obj in resolved_additional_members:
                members_to_set.add(user_obj)
            
            instance.members.set(list(members_to_set)) 

        return instance

class BotSubmissionSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)
    submitted_by_username = serializers.CharField(source='submitted_by.username', read_only=True)

    code_text = serializers.CharField(
        write_only=True,  
        required=False,   
        allow_blank=True,
        style={'base_template': 'textarea.html'} 
    )

    class Meta:
        model = BotSubmission
        fields = (
            'id',
            'team',
            'team_name',
            'submitted_by',
            'submitted_by_username',
            'code_file',
            'code_text',
            'submitted_at',
            'is_active',
            'plagiarism_flagged'
        )

        read_only_fields = ('submitted_at', 'team','submitted_by')
    
    def validate_code_file(self, value):
        if not value.name.endswith('.py'):
            raise serializers.ValidationError('Only .py files are allowed for submissions')
        if value.size > 1*1024*1024:
            # TODO: Potentially reduce this file size.
            raise serializers.ValidationError("File size cannot exceed 1MB.")
        
        return value
    
    def update(self, instance, validated_data):
        code_text = validated_data.pop('code_text', None)

        instance.is_active = validated_data.get('is_active', instance.is_active)

        if code_text is not None:
            current_filename = os.path.basename(instance.code_file.name) if instance.code_file and instance.code_file.name else f"{instance.id.hex}.py"

            if not current_filename.endswith('.py'):
                base_fn, _ = os.path.splitext(current_filename)
                current_filename = base_fn + '.py'

            instance.code_file.save(current_filename, ContentFile(code_text.encode('utf-8')), save=False)


        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        return instance

class SimpleTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ('id', 'name')

class MatchSerializer(serializers.ModelSerializer):
    match_type_display = serializers.CharField(source='get_match_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    player1_team_name = serializers.CharField(source='player1_submission.team.name', read_only=True, allow_null=True)
    player2_team_name = serializers.SerializerMethodField(read_only=True)

    winning_team_details = SimpleTeamSerializer(source='winning_team', read_only=True, allow_null=True)

    game_log_url = serializers.FileField(source='game_log', read_only=True)

    class Meta:
        model = Match

        fields = (
            'id',
            'match_type',
            'match_type_display',
            'status',
            'status_display',
            'created_at',
            'played_at',
            'player1_submission', 
            'player1_team_name',
            'player2_submission', 
            'is_player2_system_bot',
            'player2_team_name',
            'player1_score',
            'player2_score',
            'winning_team', 
            'round_stage',
            'winning_team_details',
            'game_log_url', 
        )

        read_only_fields = (
            'id', 'created_at', 'played_at', 'status', 'status_display',
            'player1_score', 'player2_score', 'winning_team', 'game_log',
            'player1_team_name', 'player2_team_name', 'match_type_display'
        )
    
    def get_player2_team_name(self, obj):
        if obj.is_player2_system_bot:
            return "System Bot"
        if obj.player2_submission and obj.player2_submission.team:
            return obj.player2_submission.team.name
        return None
    

class LeaderboardScoreSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True)

    class Meta:
        model = LeaderboardScore
        fields = ('id', 'team', 'team_name', 'score', 'matches_played', 'matches_won', 'last_updated')
        read_only_fields = ('id', 'team_name', 'last_updated')

class ChallengeTeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ('id', 'name')

class ChallengeSerializer(serializers.ModelSerializer):
    challenger_team_details = SimpleTeamSerializer(source='challenger_team', read_only=True)
    challenged_team_details = SimpleTeamSerializer(source='challenged_team', read_only=True)
    
    challenged_team = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), 
        write_only=True
    )
    
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    match_played_id = serializers.UUIDField(source='match_played.id', read_only=True, allow_null=True)


    class Meta:
        model = Challenge

        fields = (
            'id',
            'challenged_team_details',
            'challenged_team',
            'challenger_team_details',
            'message',
            'status',
            'status_display',
            'created_at',
            'resolved_at',
            'match_played_id',
        )

        read_only_fields = ('status', 'created_at', 'resolved_at')

    def validate(self, data):
        request = self.context.get('request')

        if not request or not hasattr(request, 'user'):
            raise serializers.ValidationError('Request context not found.')
        
        challenger_team = Team.objects.filter(
            Q(creator=request.user) | Q(members=request.user)
        ).first()

        if not challenger_team:
            raise('User not part of the team.')
        
        challenged_team = data.get('challenged_team')

        if challenger_team == challenged_team:
            raise serializers.ValidationError('A team cannot challenge itself.')
        
        existing_challenge = Challenge.objects.filter(
            challenger_team=challenger_team,
            challenged_team=challenged_team,
            status=Challenge.ChallengeStatus.PENDING
        )

        if existing_challenge:
            raise serializers.ValidationError('An active challenge already exists between the two teams.')
        
        return data