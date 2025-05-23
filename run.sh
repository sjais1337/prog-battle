DJANGO_PID=""
CELERY_PID=""

cleanup() {
    echo ""
    echo "--- Interrupted. Cleaning up background processes... ---"

    if [ -n "$DJANGO_PID" ]; then
        echo "Stopping Django development server (PID: $DJANGO_PID)..."
        kill $DJANGO_PID
        sleep 2
        if ps -p $DJANGO_PID > /dev/null; then
            echo "Django server (PID: $DJANGO_PID) did not stop gracefully, sending SIGKILL..."
            kill -9 $DJANGO_PID
        else
            echo "Django server (PID: $DJANGO_PID) stopped."
        fi
        wait $DJANGO_PID 2>/dev/null 
    else
        echo "Django server PID not captured or already stopped."
    fi

    if [ -n "$CELERY_PID" ]; then
        echo "Stopping Celery worker (PID: $CELERY_PID)..."
        kill $CELERY_PID
        sleep 2
        if ps -p $CELERY_PID > /dev/null; then
            echo "Celery worker (PID: $CELERY_PID) did not stop gracefully, sending SIGKILL..."
            kill -9 $CELERY_PID
        else
            echo "Celery worker (PID: $CELERY_PID) stopped."
        fi
        wait $CELERY_PID 2>/dev/null
    else
        echo "Celery worker PID not captured or already stopped."
    fi

    if command -v deactivate &> /dev/null; then
      echo "Deactivating virtual environment..."
      deactivate
    fi

    echo "--- Cleanup Complete ---"
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "--- Starting Application ---"

echo "Activating virtual environment..."
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
  echo "Virtual environment activated."
else
  echo "Error: Virtual environment not found. Please run the initialization script first."
  exit 1
fi

echo "Starting Django development server in the background..."
python manage.py runserver &
DJANGO_PID=$!
echo "Django development server started with PID: $DJANGO_PID"

echo "Starting Celery worker in the background..."
celery -A backend worker -l info &
CELERY_PID=$!
echo "Celery worker started with PID: $CELERY_PID"

cd frontend
echo "Currently in $(pwd)"

echo "Starting frontend development server (this will run in the foreground)..."
echo "Press Ctrl+C to stop all processes."

npm run start

echo "--- Application Script End (should not be reached if trap/cleanup worked) ---"
