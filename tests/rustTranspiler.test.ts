import { assert } from 'console';
import { Transpiler } from '../src/transpiler';
import { readFileSync } from 'fs';

jest.mock('module', () => ({
    __esModule: true,
    default: jest.fn()
}));

let transpiler: Transpiler;

beforeAll(() => {
    const config = {
        'verbose': false,
        'rust': {
            'parser': {
                'NUM_LINES_END_FILE': 0,
            }
        }
    }
    transpiler = new Transpiler(config);
});

describe('rust transpiling tests', () => {
    test('basic variable declaration', () => {
        const ts = "const x = 1;";
        const rust = "let x = 1;";
        const output = transpiler.transpileRust(ts).content;
        expect(output).toBe(rust);
    });

    test('basic class declaration', () => {
        const ts = 
        "class Test {\n" +
        "    main() {\n" +
        "        return 1;\n" +
        "    }\n" +
        "}";
        const rust = 
        "struct Test {\n" +
        "}\n\n" +
        "impl Test {\n" +
        "    fn new() -> Self {\n" +
        "        Test {}\n" +
        "    }\n\n" +
        "    fn main(&self) -> i32 {\n" +
        "        1\n" +
        "    }\n" +
        "}";
        const output = transpiler.transpileRust(ts).content;
        expect(output).toBe(rust);
    });

    test('class with inheritance', () => {
        const ts =
        "class A {\n" +
        "    first() {\n" +
        "        console.log(\"First method\");\n" +
        "    }\n" +
        "}\n\n" +
        "class B extends A {\n" +
        "    second() {\n" +
        "        const a = 1;\n" +
        "        const b = 2;\n" +
        "        const c = a + b;\n" +
        "        console.log(\"Result is \" + c);\n" +
        "    }\n" +
        "}";
        const rust =
        "trait A {\n" +
        "    fn first(&self);\n" +
        "}\n\n" +
        "struct B {\n" +
        "}\n\n" +
        "impl B {\n" +
        "    fn new() -> Self {\n" +
        "        B {}\n" +
        "    }\n\n" +
        "    fn second(&self) {\n" +
        "        let a = 1;\n" +
        "        let b = 2;\n" +
        "        let c = a + b;\n" +
        "        println!(\"Result is {}\", c);\n" +
        "    }\n" +
        "}\n\n" +
        "impl A for B {\n" +
        "    fn first(&self) {\n" +
        "        println!(\"First method\");\n" +
        "    }\n" +
        "}";
        const output = transpiler.transpileRust(ts).content;
        expect(output).toBe(rust);
    });

    test('console log statements', () => {
        const ts = 'console.log("Hello " + name + "!");';
        const rust = 'println!("Hello {} !", name);';
        const output = transpiler.transpileRust(ts).content;
        expect(output).toBe(rust);
    });

    test('array operations', () => {
        const ts = 
        "let arr = [1, 2, 3];\n" +
        "arr.push(4);\n" +
        "const len = arr.length;";
        const rust =
        "let arr = vec![1, 2, 3];\n" +
        "arr.push(4);\n" +
        "let len = arr.len();";
        const output = transpiler.transpileRust(ts).content;
        expect(output).toBe(rust);
    });

    test('string operations', () => {
        const ts = 
        'const str = "hello";\n' +
        'const upper = str.toUpperCase();\n' +
        'const contains = str.contains("el");';
        const rust =
        'let str = "hello";\n' +
        'let upper = str.to_uppercase();\n' +
        'let contains = str.contains("el");';
        const output = transpiler.transpileRust(ts).content;
        expect(output).toBe(rust);
    });
}); 