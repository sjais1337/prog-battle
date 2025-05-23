from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from django.contrib.auth import get_user_model
from tournament.models import Team

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True)

    class Meta: 
        model = User
        fields = ('username', 'email', 'password','password2', 'first_name','last_name')

        extra_kwargs = {
            'first_name': {'required': False},
            'last_name': {'required': False}
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        
        if User.objects.filter(email=attrs['email']).exists():
            raise serializers.ValidationError({"email": "Email is already registered."})
        
        return attrs

    def create(self, validated_data):
        user = User.objects.create(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )

        user.set_password(validated_data['password'])
        user.save()

        return user
    

class BasicTeamInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ('id', 'name')

class UserDetailSerializer(serializers.ModelSerializer):

    teams = BasicTeamInfoSerializer(
        source='members_of_team',
        many=True, 
        read_only=True
    )

    class Meta:
        model = User
        fields = (
            'id', 
            'username', 
            'email', 
            'first_name', 
            'last_name', 
            'teams'
        )