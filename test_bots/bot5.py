import random

def next_move(state):
    ball_x = state["ball"]["x"]
    ball_dx = state["ball"].get("dx", 0) 
    my_x = state["you"]["x"]
    paddle_width = state["you"].get("width", 2)

    predicted_ball_x = ball_x + ball_dx 
    target_my_x = predicted_ball_x - (paddle_width // 2)

    if random.random() < 0.05:
        return random.choice(["left", "right", "stay"])

    if target_my_x < my_x:
        action = "left"
    elif target_my_x > my_x: 
        action = "right"
    else:
        action = "stay"

    return action