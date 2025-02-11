import { assert } from 'console';
import { Transpiler } from '../src/transpiler';
import { readFileSync } from 'fs';

jest.mock('module',()=>({
    __esModule: true,                 // this makes it work
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
})

describe("Rust Transpiler Tests", () => {
  test("Basic class declaration", () => {
    const tsCode = `
      class A {
          first() {
              console.log("First method");
          }
      }`;
    const expectedRust = `struct A {
}

impl A {
    fn first(&self) {
        println!("First method");
    }
}`;
    const output = transpiler.transpileRust(tsCode).content.trim();
    expect(output).toBe(expectedRust.trim());
  });

  test("Class inheritance and method delegation", () => {
    const tsCode = `
      class A {
          first() {
              console.log("First method");
          }
      }

      class B extends A {
          second() {
              const a = 1;
              const b = 2;
              const c = a + b;
              console.log("Result is " + c);
          }
      }

      const obj = new B();
      obj.first();
      obj.second();`;
    const expectedRust = `struct A {
}

impl A {
    fn first(&self) {
        println!("First method");
    }
}

struct B {
    base: A,
}

impl B {
    fn second(&self) {
        let a = 1;
        let b = 2;
        let c = a + b;
        println!("{}{}", "Result is ", c);
    }
    fn first(&self) { self.base.first(); }
}

impl B {
    fn new() -> B {
        B { base: A {} }
    }
}

fn main() {
    let obj = B::new();
    obj.first();
    obj.second();
}`;
    const output = transpiler.transpileRust(tsCode).content.trim();
    expect(output).toBe(expectedRust.trim());
  });

  test("Variable declarations", () => {
    const tsCode = `const x = 1;`;
    const expectedRust = `let x = 1`;
    const output = transpiler.transpileRust(tsCode).content.trim();
    expect(output).toBe(expectedRust.trim());
  });

  test("Console output", () => {
    const tsCode = `console.log("Hello, world!");`;
    const expectedRust = `println!("Hello, world!");`;
    const output = transpiler.transpileRust(tsCode).content.trim();
    expect(output).toBe(expectedRust.trim());
  });

  test("String concatenation in println!", () => {
    const tsCode = `console.log("Number: " + 42);`;
    const expectedRust = `println!("{}{}", "Number: ", 42);`;
    const output = transpiler.transpileRust(tsCode).content.trim();
    expect(output).toBe(expectedRust.trim());
  });

  test("Constructor call conversion", () => {
    const tsCode = `const obj = new B();`;
    const expectedRust = `let obj = B::new();`;
    const output = transpiler.transpileRust(tsCode).content.trim();
    expect(output).toBe(expectedRust.trim());
  });
});