import tkinter as tk
from tkinter import ttk
import random

root = tk.Tk()
root.title("Fun Fact")

# Setting a fixed size for the window (this will work well on both macOS and Windows)
root.geometry("800x600")

# Configuring background color
root.config(bg="#f5f5dc")

# Fun fact data (using a sample continent here, you can modify or load from file)
continent = "Asia".lower() + "\n"  # need the API here

colors = ["#4b0082", "#2e8b57", "#ff6347", "#4682b4", "#8a2be2", "#d2691e", "#ff4500", "#32cd32"]

# Function for showing another fact
def other_fact(i: int) -> None:
    new_color = random.choice(colors)
    label.config(text=data[i + 3], wraplength=400, font=("Arial", 30), fg=new_color)
    button.config(command=lambda: other_fact(i + 2))

# Function for updating progress
def update_progress(current_value):
    if current_value < 100:
        progress['value'] += 1
        root.after(50, update_progress, current_value + 1)
    else:
        root.after(500, stop_loading)

# Function to stop loading
def stop_loading():
    root.quit()
    print("Loading complete!")

# Load the continent data from a file
try:
    with open("continent.txt", "r") as f:
        data = f.readlines()
        for i in range(len(data)):
            if data[i] == continent:
                fun_fact = data[i + 1]

                # Create a label to display the fun fact
                label = tk.Label(root, text=fun_fact, wraplength=600, font=("Arial", 30), fg="#2e8b57", bg="#f5f5dc", padx=20, pady=20)
                label.pack(expand=True)

                # Create the "Another" button
                button = tk.Button(root, text="Another", font=("Arial", 30), command=lambda i=i: other_fact(i), bg="#4caf50", fg="white", activebackground="#45a049", relief="solid", bd=3)
                button.pack(expand=True)

                # Create and display the progress bar
                progress = ttk.Progressbar(root, orient="horizontal", length=600, mode="determinate", style="TProgressbar")
                progress.pack(expand=True)
                # Start the progress bar
                update_progress(0)
except FileNotFoundError:
    print("The file 'continent.txt' was not found. Please make sure the file is in the correct location.")

# Styling for the progress bar
style = ttk.Style()
style.configure("TProgressbar", thickness=20, troughcolor="#dcdcdc", background="#4caf50")

# Start the Tkinter main loop
root.mainloop()
