# Prog Battle - PClub Task

This repository contains the source code and instructions to run for my submission for the **PClub Recruitment Task: Prog Battle**. The project is built on django (backend) and NextJS (frontend). The bonus task challenge, and queueing up tasks have been implemented.

## Research
Not much research was involved, but I discovered celery and redis for asynchronous updates. 

## Initializing
The project requires nodejs, npm, python, pip and redis-server installed and set-up on a linux machine to run properly. Though it can be run on Windows easily, instructions here are provided only for Linux desktop environments. The .sh files can be run on windows too by using git bash terminal, and redis may be installed using an .exe file I suppose. 

Please install redis-server using the package manager corresponding to your distro, on Ubuntu systems, it can be installed using the following command `sudo apt update && sudo apt install redis-server`. After installation it must be confirmed that the service is running properly. To run the service, 
```sh
sudo systemctl enable redis-server
sudo systemctl start redis-server
```
Once all the required services are up and running properly, the `init.sh` utility may be used to initialize the application. The utility initializes a virtual environment, installs the required python packages, checks if the redis server is up and running, makes and applies the migrations for the db models, installs npm packages and finally builds the frontend.

If the `.sh` files are not executeable then change their permissions by using `chmod +x init.sh` and `chmod +x run.sh` to make them executeable. 
## Running 
After running the `init.sh`, the application is ready to be started. The `run.sh` utility may be used to start the celery service, python server and the front end in a single go. The application may be accessed at `localhost:3000`, with the backend being available on `localhost:8000`.

### Tournament
Keeping in mind that practically the tournament will be controlled by the admin, using a admin interface, the tournament has been designed to be run using CLI commands. To populate the database with Users, BotSubmissions and Teams, run the following comamnd. Also note that all the commands of django must be run while in the virtual environment, which can be accessed by using `source venc/bin/activate` while in the root directory. 

```sh
python manage.py populate_db --num_teams=<number_of_teams> --password=<OPTIONAL: password_for_users>
```
This creates a number of users with usernames like `user1`, `user2` and so on with the specified password. Not much variation has been allowed to allow for simplicty during testing. Make sure that the number of teams created is more than 16 so thar the Round 2 of the tournament can be tested, a good number would be 24 or 32. 

#### Round 1
To start the first round of the tournament against the provided system bot, run the following command
```sh
python manage.py start_round_one --games_per_team=<num_games>
```
It runs `num_games` number of matches against the system for each user which are queued up and run asynchronously using celery. The more the number of games, the longer it takes for the matches to be finished, but also, more accurate is the difference between each bot, which can help prevent ties between bots. I recommend using 5 as the number of games for a good measure. 

#### Round 2 
The round 2 is entirely managed using the command line. This is also a result of a security consideration to prevent unnecesary complexity, which may accidentally leave vulnerable endpoints with admin capabilities open to other users. The tournament is customizeable, and can be run with more than 16 people too, but they must be multiples of 32. However, the Bracket page isn't capable of handling more than 16 matches, due to time constraints and no explicit mention of such a requirement in the task description. The entire tournament can be run by sequentially running the following commands, waiting for a couple seconds after every execution to make sure the queued tasks have finished executing.

```sh
python manage.py manage_round_two --stage_teams=16 --initial_qualifiers_count=16
python manage.py manage_round_two --stage_teams=8 --initial_qualifiers_count=16
python manage.py manage_round_two --stage_teams=4 --initial_qualifiers_count=16
python manage.py manage_round_two --stage_teams=2 --initial_qualifiers_count=16
```

The `--stage_teams` flag signifies the number of teams participating in the given stage, and `--initial_qualifiers_count` flag, as the name implies is used to tell the program how many teams have initially qualified. 
