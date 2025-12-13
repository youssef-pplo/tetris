# Tetris AI Ultimate

A browser-based Tetris game with neural network AI training capabilities. Train a neural network to play Tetris or test your own skills!

## Features

- 🎮 **Classic Tetris Gameplay** - Play the classic game yourself
- 🤖 **AI Training Mode** - Watch a neural network learn to play
- 🎨 **Beautiful Graphics** - High-quality graphics with glow effects
- ⚡ **Performance Mode** - Low graphics mode for better battery/performance
- 📊 **Real-time Training Dashboard** - Monitor AI training progress with strategy weights
- 🎯 **Customizable AI** - Adjust population size and mutation rate
- 📱 **Mobile Support** - Touch controls for mobile devices

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js (optional, for local development server)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/youssef-pplo/tetris.git
cd tetris
```

2. Install dependencies (optional):
```bash
npm install
```

3. Run the development server:
```bash
npm start
```

Or simply open `index.html` in your browser.

## Usage

### Playing the Game

1. Click **"Play Game"** to play manually
2. Use **Arrow Keys** or **Touch Controls** to move and rotate pieces
3. **Space** to hard drop
4. Clear lines to increase your score!

### Training the AI

1. Click **"Train AI"** to start AI training mode
2. Watch as the neural network learns through generations
3. Adjust training speed with the slider (supports fractional speeds)
4. View the best agent's strategy weights in real-time
5. Configure AI settings (population, mutation rate) via the "AI Config" button
6. Drag the dashboard to move it around

### Settings

- **Graphics Quality**: Switch between High (fancy effects) and Low (better performance)
- **AI Configuration**: Customize population size and mutation rate

## Technical Details

### AI Architecture

The AI uses a genetic algorithm with a linear evaluation function:
- **Genome**: 4 weights for different game metrics
  - Aggregate Height (minimize)
  - Complete Lines (maximize)
  - Holes (minimize)
  - Bumpiness (minimize)
- **Population**: Configurable (default: 50)
- **Mutation Rate**: Configurable (default: 0.1)
- **Elitism**: Top 2 performers survive to next generation

### Game Mechanics

- Classic Tetris rules
- 7 different piece types (I, T, L, J, Z, S, O)
- Level progression every 10 lines
- Score multipliers for line clears (1, 2, 3, 4 lines)

## File Structure

```
tetris-ai/
├── index.html      # Main HTML file
├── styles.css      # All CSS styles
├── script.js       # Game logic and AI
├── package.json    # Project configuration
├── .gitignore      # Git ignore rules
└── README.md       # This file
```

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance Tips

- Use **Low Graphics** mode on mobile devices or older hardware
- Reduce **Population Size** if experiencing lag during AI training
- Lower **Training Speed** for smoother animation
- Training speed supports fractional values (0.1x to 50x)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for learning or personal projects.

## Credits

Created by [youssef pplo](https://pplo.dev)

## Acknowledgments

- Inspired by the classic Tetris game
- AI implementation based on genetic algorithms with linear evaluation
- Built with vanilla JavaScript (no frameworks required)

