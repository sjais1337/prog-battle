def next_move(state):
    ball_x = state["ball"]["x"]
    my_x = state["you"]["x"]

    if ball_x < my_x:
        action = "right"
    elif ball_x > my_x + 1:
        action = "left"
    else:
        action = "left" 
    
    return action