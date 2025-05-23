set -e

echo "--- Starting Repository Initialization ---"

if [ -d "venv" ]; then
  echo "Virtual environment 'venv' already exists. Skipping creation."
else
  # Create a virtual environment
  echo "Creating virtual environment..."
  python3 -m venv venv
  echo "Virtual environment 'venv' created."
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Virtual environment activated."

echo "Installing Python dependencies..."
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers celery redis
echo "Python dependencies installed."


echo "Checking Redis server status..."
if systemctl is-active --quiet redis-server; then
  echo "Redis server is active."
else
  echo "Redis server is not active or not installed."
  echo "Please install Redis server and ensure it is running."
  if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "Deactivating virtual environment..."
    deactivate
  fi
  exit 1
fi

echo "Making migrations for 'accounts' app..."
python manage.py makemigrations accounts
echo "Migrations for 'accounts' app created."

echo "Making migrations for 'tournament' app..."
python manage.py makemigrations tournament
echo "Migrations for 'tournament' app created."

echo "Applying database migrations..."
python manage.py migrate
echo "Database migrations applied."

echo "Navigating to frontend directory..."
cd frontend
echo "Currently in $(pwd)"

echo "Installing node-js dependencies..."
npm i
echo "Dependencies installed..."

echo "Building frontend application..."
npm run build
echo "Frontend application built."

echo "Navigating back to project root directory..."
cd ..
echo "Currently in $(pwd)"

echo "--- Repository Initialization Complete ---"
