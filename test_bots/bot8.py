import random

def next_move(state):
    ball_x = state["ball"]["x"]
    my_x = state["you"]["x"]
    paddle_width = state["you"].get("width", 2)

    if ball_x < my_x:
        return "left"
    elif ball_x > my_x + (paddle_width - 1):
        return "right"

    if random.random() < 0.6: 
        if random.random() < 0.7: 
            return "left"
        else:
            return "right" 

    return "stay"