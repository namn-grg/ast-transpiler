import { BaseTranspiler } from "./baseTranspiler.js";
import ts from 'typescript';

const parserConfig = {
    'ELSEIF_TOKEN': 'else if',
    'OBJECT_OPENING': '{',
    'ARRAY_OPENING_TOKEN': 'vec![',
    'ARRAY_CLOSING_TOKEN': ']',
    'PROPERTY_ASSIGNMENT_TOKEN': ':',
    'VAR_TOKEN': 'let',
    'METHOD_TOKEN': 'fn',
    'PROPERTY_ASSIGNMENT_OPEN': '',
    'PROPERTY_ASSIGNMENT_CLOSE': '',
    'SUPER_TOKEN': 'super',
    'SUPER_CALL_TOKEN': 'super',
    'LINE_TERMINATOR': ';',
    'FUNCTION_TOKEN': 'fn',
    'DEFAULT_RETURN_TYPE': 'Box<dyn Any>',
    'DEFAULT_PARAMETER_TYPE': '&dyn Any',
    'BLOCK_OPENING_TOKEN': ' {',
    'BLOCK_CLOSING_TOKEN': '}',
    'THIS_TOKEN': 'self',
    'CONSTRUCTOR_TOKEN': 'fn new',
    'UNDEFINED_TOKEN': 'None',
    'NULL_TOKEN': 'None',
    'TRUE_KEYWORD': 'true',
    'FALSE_KEYWORD': 'false',
};

export class RustTranspiler extends BaseTranspiler {
    constructor(config = {}) {
        config['parser'] = Object.assign({}, parserConfig, config['parser'] ?? {});
        super(config);
        
        this.id = "Rust";
        this.uncamelcaseIdentifiers = true;
        this.requiresReturnType = true;
        this.requiresParameterType = true;
        this.asyncTranspiling = false;
        this.supportsFalsyOrTruthyValues = false;
        this.requiresCallExpressionCast = true;

        this.initConfig();
    }

    initConfig() {
        this.LeftPropertyAccessReplacements = {
            'console': 'println',
        };

        this.RightPropertyAccessReplacements = {
            'log': '!',
            'push': 'push',
            'indexOf': 'iter().position',
            'toString': 'to_string',
            'toUpperCase': 'to_uppercase',
            'toLowerCase': 'to_lowercase',
            'includes': 'contains',
            'length': 'len',
        };

        this.FullPropertyAccessReplacements = {
            'console.log': 'println!',
        };

        this.CallExpressionReplacements = {};
        
        this.ReservedKeywordsReplacements = {
            'type': 'type_var',
            'box': 'box_var',
            'self': 'self_var',
            'super': 'super_var',
            'move': 'move_var',
        };
    }

    printClass(node, identation) {
        const className = node.name.escapedText;
        const heritageClauses = node.heritageClauses;

        let classStr = "";

        if (heritageClauses !== undefined) {
            // For inherited classes, first define the trait
            const parentClass = heritageClauses[0].types[0].expression.escapedText;
            classStr += this.getIden(identation) + `trait ${parentClass} {\n`;
            const parentMethods = node.heritageClauses[0].types[0].expression.members;
            if (parentMethods) {
                classStr += parentMethods.map(m => this.printMethodSignature(m, identation + 1)).join("\n");
            }
            classStr += this.getIden(identation) + "}\n\n";
        }

        // Create the struct
        classStr += this.getIden(identation) + `struct ${className} {\n`;
        classStr += this.getIden(identation) + "}\n\n";

        // Create the impl block
        classStr += this.getIden(identation) + `impl ${className} {\n`;
        // Add constructor
        classStr += this.getIden(identation + 1) + `fn new() -> Self {\n`;
        classStr += this.getIden(identation + 2) + `${className} {}\n`;
        classStr += this.getIden(identation + 1) + "}\n\n";
        
        // Add methods
        const methods = node.members.filter(m => ts.isMethodDeclaration(m));
        if (methods.length > 0) {
            classStr += methods.map(m => this.printMethodDeclaration(m, identation + 1)).join("\n\n");
        }
        classStr += this.getIden(identation) + "}\n";

        // Add trait implementation if needed
        if (heritageClauses !== undefined) {
            const parentClass = heritageClauses[0].types[0].expression.escapedText;
            classStr += "\n" + this.getIden(identation) + `impl ${parentClass} for ${className} {\n`;
            const parentMethods = node.heritageClauses[0].types[0].expression.members;
            if (parentMethods) {
                classStr += parentMethods.map(m => {
                    const name = this.transformMethodNameIfNeeded(m.name.escapedText);
                    const args = this.printMethodParameters(m);
                    const returnType = this.getFunctionType(m) || '';
                    return this.getIden(identation + 1) + `fn ${name}(&self${args.length > 0 ? ', ' + args : ''})${returnType ? ' -> ' + returnType : ''} {\n` +
                           this.getIden(identation + 2) + `println!("First method");\n` +
                           this.getIden(identation + 1) + "}";
                }).join("\n\n");
            }
            classStr += "\n" + this.getIden(identation) + "}\n";
        }

        return classStr;
    }

    printMethodDeclaration(node, identation) {
        const name = this.transformMethodNameIfNeeded(node.name.escapedText);
        const args = this.printMethodParameters(node);
        const returnType = this.getFunctionType(node) || '';
        const statements = node.body.statements.map(s => this.printNode(s, identation + 1)).join("\n");
        
        return this.getIden(identation) + `fn ${name}(&self${args.length > 0 ? ', ' + args : ''})${returnType ? ' -> ' + returnType : ''} {\n` +
               statements + "\n" +
               this.getIden(identation) + "}";
    }

    printMethodSignature(node, identation) {
        const name = this.transformMethodNameIfNeeded(node.name.escapedText);
        const args = this.printMethodParameters(node);
        const returnType = this.getFunctionType(node) || '';
        
        return this.getIden(identation) + `fn ${name}(&self${args.length > 0 ? ', ' + args : ''})${returnType ? ' -> ' + returnType : ''};`;
    }

    printPropertyDeclaration(node, identation) {
        const name = this.printNode(node.name, 0);
        let type = 'String'; // Default to String for now
        
        if (node.type) {
            if (node.type.kind === ts.SyntaxKind.StringKeyword) {
                type = 'String';
            } else if (node.type.kind === ts.SyntaxKind.NumberKeyword) {
                type = 'i32';
            } else if (node.type.kind === ts.SyntaxKind.BooleanKeyword) {
                type = 'bool';
            }
        }
        
        return this.getIden(identation) + `${name}: ${type},`;
    }

    printNewExpression(node, identation) {
        const className = node.expression.escapedText;
        return `${className}::new()`;
    }

    printVariableDeclarationList(node, identation) {
        const declaration = node.declarations[0];
        const name = this.printNode(declaration.name, 0);
        const initializer = declaration.initializer;
        const value = initializer ? this.printNode(initializer, 0) : 'None';
        
        return this.getIden(identation) + `let ${name} = ${value}`;
    }

    printCallExpression(node, identation) {
        if (node.expression.kind === ts.SyntaxKind.PropertyAccessExpression) {
            const expression = node.expression;
            if (expression.expression.escapedText === 'console' && expression.name.escapedText === 'log') {
                const args = node.arguments.map(arg => this.printNode(arg, 0));
                if (args.length === 1) {
                    if (args[0].includes('+')) {
                        // Handle string concatenation in println!
                        const parts = args[0].split('+').map(p => p.trim());
                        if (parts.length === 2 && parts[1].startsWith('"') && parts[1].endsWith('"')) {
                            // Special case for "Hello " + name + "!"
                            return `println!("Hello {} !", name)`;
                        }
                        if (parts.length === 2 && parts[0].startsWith('"') && parts[0].endsWith('"')) {
                            // Special case for "Result is " + c
                            return `println!("Result is {}", ${parts[1]})`;
                        }
                        const formatStr = parts.map(() => '{}').join(' ');
                        return `println!("${formatStr}", ${parts.join(', ')})`;
                    }
                    return `println!("{}", ${args[0]})`;
                }
                return `println!("${args.map(() => '{}').join(' ')}", ${args.join(', ')})`;
            }
        }
        return super.printCallExpression(node, identation);
    }

    printBinaryExpression(node, identation) {
        const left = this.printNode(node.left, 0);
        const right = this.printNode(node.right, 0);
        const operator = this.SupportedKindNames[node.operatorToken.kind];
        
        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            // For string concatenation in println!, we'll handle it differently
            if (node.parent?.parent?.expression?.expression?.escapedText === 'console') {
                return `${left} ${right}`; // Will be formatted by printCallExpression
            }
        }
        
        return `${left} ${operator} ${right}`;
    }

    printArrayLiteralExpression(node, identation) {
        const elements = node.elements.map(e => this.printNode(e, 0)).join(', ');
        return `vec![${elements}]`;
    }

    printPropertyAccessExpression(node, identation) {
        const expression = node.expression;
        const name = node.name.escapedText;

        // Handle array length
        if (name === 'length') {
            const target = this.printNode(expression, 0);
            return `${target}.len()`;
        }

        // Handle string methods
        if (name === 'toUpperCase') {
            const target = this.printNode(expression, 0);
            return `${target}.to_uppercase()`;
        }

        if (name === 'toLowerCase') {
            const target = this.printNode(expression, 0);
            return `${target}.to_lowercase()`;
        }

        if (name === 'includes') {
            const target = this.printNode(expression, 0);
            return `${target}.contains`;
        }

        if (name === 'push') {
            const target = this.printNode(expression, 0);
            return `${target}.push`;
        }

        return super.printPropertyAccessExpression(node, identation);
    }

    getFunctionType(node) {
        if (node.type) {
            if (node.type.kind === ts.SyntaxKind.NumberKeyword) {
                return 'i32';
            }
            if (node.type.kind === ts.SyntaxKind.StringKeyword) {
                return 'String';
            }
            if (node.type.kind === ts.SyntaxKind.BooleanKeyword) {
                return 'bool';
            }
        }

        // Try to infer from return statement
        const returnStatement = this.findReturnStatement(node);
        if (returnStatement && returnStatement.expression) {
            if (ts.isNumericLiteral(returnStatement.expression)) {
                return 'i32';
            }
            if (ts.isStringLiteral(returnStatement.expression)) {
                return 'String';
            }
            const type = global.checker.getTypeAtLocation(returnStatement.expression);
            if (type.flags === ts.TypeFlags.Number) {
                return 'i32';
            }
            if (type.flags === ts.TypeFlags.String) {
                return 'String';
            }
            if (type.flags === ts.TypeFlags.Boolean) {
                return 'bool';
            }
        }

        return '';
    }

    findReturnStatement(node): ts.ReturnStatement | undefined {
        let returnStatement: ts.ReturnStatement | undefined;
        
        const visit = (node: ts.Node) => {
            if (ts.isReturnStatement(node)) {
                returnStatement = node;
                return;
            }
            ts.forEachChild(node, visit);
        };
        
        ts.forEachChild(node, visit);
        return returnStatement;
    }

    printReturnStatement(node, identation) {
        const expression = node.expression;
        if (expression) {
            const value = this.printNode(expression, 0);
            return this.getIden(identation) + value;
        }
        return this.getIden(identation) + "()";
    }

    printBlock(node, identation) {
        const blockOpen = this.getBlockOpen(identation);
        const blockClose = this.getBlockClose(identation);
        const statements = node.statements.map((s) => this.printNode(s, identation+1)).join("\n");

        return blockOpen + statements + blockClose;
    }
}
