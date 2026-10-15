// Example recipe — warm landscape with Vibrance + Color Balance + Photo Filter.
// Recipe entry file: set a global RECIPE object and run RecipeRunner.run(RECIPE).
// Must be concatenated after ps_core.jsx + recipe_runner.jsx.
// See AGENTS.md for the full console invocation pattern.

var RECIPE = {
    input: '/path/to/input.jpg',
    output: {
        psd: '/path/to/output.psd',
        jpg: '/path/to/output.jpg'
    },
    operations: [
        { op: 'vibrance',         name: 'Vibranta',     vibrance: 38, saturation: 6 },
        { op: 'colorBalance',     name: 'Echilibru cald', midtones: [22, 6, -16], highlights: [10, 2, -6], shadows: [6, 0, -4] },
        { op: 'photoFilter',      name: 'Filtru cald',  red: 236, green: 150, blue: 60, density: 32, preserve: true }
    ]
};

RecipeRunner.run(RECIPE);