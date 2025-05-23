# Prog Battle - PClub Task

This repository contains the source code and instructions to run for my submission for the **PClub Recruitment Task: Prog Battle**. The project is built on django (backend) and NextJS (frontend). 

### Initializing
The project requires nodejs, npm, python, pip and redis-server installed and set-up on a linux machine to run properly. Though it can be run on Windows easily, instructions here are provided only for Linux desktop environments. The .sh files can be run on windows too by usage of git bash.

Please install redis-server using the package manager corresponding to your distro, on Ubuntu systems, it can be installed using the following command `sudo apt update && sudo apt install redis-server`. After installation it must be confirmed that the service is running properly. To run the service, 
```sh
sudo systemctl enable redis-server
sudo systemctl start redis-server
```
Once all the required services are up and running properly, the `init.sh` utility may be used to initialize the application. The utility initializes a virtual environment, installs the required python packages, checks if the redis server is up and running, makes and applies the migrations for the db models, installs npm packages and finally builds the frontend.

If the `.sh` files are not executeable then change their permissions by using `chmod +x init.sh` and `chmod +x run.sh` to make them executeable. 
### Running 
After running the `init.sh`, the application is ready to be started. The `run.sh` utility may be used to start the celery service, python server and the front end in a single go. The application may be accessed at `localhost:3000`, with the backend being available on `localhost:8000`.
