def next_move(state):
    ball_x = state["ball"]["x"]
    my_x = state["you"]["x"]

    if ball_x < my_x:
        action = "left"
    elif ball_x > my_x + 1:
        action = "right"
    else: 
        action = "stay"
    
    return action