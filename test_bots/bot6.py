import random

def next_move(state):
    ball_x = state["ball"]["x"]
    my_x = state["you"]["x"]
    paddle_width = state["you"].get("width", 2)
    game_width = state.get("game_settings", {}).get("width", 50) 
    center_x = (game_width // 2) - (paddle_width // 2)

    if abs(ball_x - (my_x + paddle_width // 2)) < paddle_width * 1.5 : 
        if ball_x < my_x:
            return "left"
        elif ball_x > my_x + (paddle_width -1) : 
            return "right"
        else:
            return "stay"

    if my_x < center_x:
        return "right"
    elif my_x > center_x:
        return "left"
    else:
        return "stay"