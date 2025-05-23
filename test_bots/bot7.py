import random

def next_move(state):
    ball_x = state["ball"]["x"]
    my_x = state["you"]["x"]
    paddle_width = state["you"].get("width", 2) 

    target_paddle_left_edge = ball_x - (paddle_width // 2) 

    if target_paddle_left_edge < my_x:
        action = "left"
    elif target_paddle_left_edge > my_x :
        action = "right"
    else:
        action = "stay"

    return action