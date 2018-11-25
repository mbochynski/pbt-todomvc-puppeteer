const p = require('puppeteer');
const fc = require('fast-check');

const newTodoInput = '.new-todo';
const items = '.todo-list li';
const completedItems = '.todo-list li.completed';
const removeButtons = '.todo-list .destroy';
const toggleButtons = '.todo-list .toggle';

function stringToCodepoints(str) {
    let codepoints = [];
    let i = 0;
    let codepoint;
    do {
        codepoint = str.codePointAt(i++);
        if (codepoint !== undefined) {
            codepoints.push(codepoint);
        }
    } while (codepoint !== undefined);
    return codepoints.join(',');
}

let counter = 0;

class ToDoModel {
    constructor() {
        this.count = counter++;
    }

    items = 0;
    checked = 0;
}

class AddCommand {
    constructor(value) {
        this.value = value;
    }
    check(model) {
        return this.value.length > 0;
    }
    async run(model, real) {
        await real.type(newTodoInput, `${this.value}`);
        await real.type(newTodoInput, String.fromCharCode(13));
        model.items += 1;
        const itemElements = await real.$$(items);
        expect(itemElements).toHaveLength(model.items);
    }
    toString() {
        return `ADD "${this.value}" codepoints: "${stringToCodepoints(this.value)}"`;
    }
}

class RemoveCommand {
    constructor(index) {
        this.index = index;
    }
    check(model) {
        return model.items > 0;
    }
    async run(model, real) {
        const indexToRemove = this.index % model.items;

        let itemElements = await real.$$(items);
        await itemElements[indexToRemove].hover();
        const removeButtonElements = await real.$$(removeButtons);
        await removeButtonElements[indexToRemove].click();

        model.items -= 1;

        itemElements = await real.$$(items);
        expect(itemElements).toHaveLength(model.items);
    }
    toString() {
        return 'Remove';
    }
}

test('TODO APP', async () => {
    jest.setTimeout(10 * 60 * 1000);
    const MAX_COMMANDS = 20;
    const NUMBER_OF_RUNS = 100;
    const CommandsArb = fc.commands([
        fc.unicodeString().map(v => new AddCommand(v)),
        // fc.hexaString().map(v => new AddCommand(v)),
        fc.nat().map(v => new RemoveCommand(v)),
    ], MAX_COMMANDS);

    const browser = await p.launch({
        args: ['--no-sandbox'],
        // headless: false,
        // slowMo: 100,
    });

    const page = await browser.newPage();
    await page.goto('http://todomvc.com/examples/react/#/');

    await fc.assert(
        fc.asyncProperty(CommandsArb, async (commands) => {
            await page.evaluate(() => {
                localStorage.clear();
            });
            await page.reload();
            const real = page;
            const model = new ToDoModel();
            await fc.asyncModelRun(() => ({ model, real }), commands);
        }),
        {
            verbose: true,
            numRuns: NUMBER_OF_RUNS,
        }
    );

    await browser.close();
});