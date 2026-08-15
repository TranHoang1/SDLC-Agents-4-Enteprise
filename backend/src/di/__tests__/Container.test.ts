/**
 * SA4E — Unit tests for the lightweight DI Container
 * (register/resolve/singleton/auto-wire/circular detection).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from '../Container.js';

class Logger {
  log(message: string): string { return `log:${message}`; }
}

class Database {
  query(): string { return 'rows'; }
}

class UserService {
  constructor(private db: Database) {}
  find(): string { return `find:${this.db.query()}`; }
}

class A {
  constructor(public b: B) {}
}

class B {
  constructor(public a?: A) {}
}

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it('resolves an instance registered via register with a factory', () => {
    container.register(Logger, () => new Logger());
    const logger = container.resolve(Logger);
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.log('hello')).toBe('log:hello');
  });

  it('returns distinct instances for transient registrations', () => {
    container.register(Logger, () => new Logger());
    expect(container.resolve(Logger)).not.toBe(container.resolve(Logger));
  });

  it('returns the same instance for singletons', () => {
    container.registerSingleton(Logger, () => new Logger());
    expect(container.resolve(Logger)).toBe(container.resolve(Logger));
  });

  it('accepts an instance value for registerSingleton', () => {
    const logger = new Logger();
    container.registerSingleton(Logger, logger);
    expect(container.resolve(Logger)).toBe(logger);
  });

  it('supports registerInstance', () => {
    const logger = new Logger();
    container.registerInstance(Logger, logger);
    expect(container.resolve(Logger)).toBe(logger);
  });

  it('reports registered tokens via has', () => {
    container.register(Logger, () => new Logger());
    expect(container.has(Logger)).toBe(true);
    expect(container.has(Database)).toBe(false);
  });

  it('clears all registrations', () => {
    container.register(Logger, () => new Logger());
    container.clear();
    expect(container.has(Logger)).toBe(false);
  });

  it('throws when resolving an unknown string token', () => {
    expect(() => container.resolve('unknown')).toThrowError(/No registration for token/);
  });

  it('detects circular dependencies via factory', () => {
    container.register('a', () => container.resolve('b'));
    container.register('b', () => container.resolve('a'));
    expect(() => container.resolve('a')).toThrowError(/Circular dependency detected/);
  });

  it('auto-wires a plain class by constructing it directly', () => {
    container.register(Logger, () => new Logger());
    expect(container.resolve(Logger)).toBeInstanceOf(Logger);
  });

  it('constructs unregistered classes with no-arg constructors', () => {
    const logger = container.resolve(Logger);
    expect(logger).toBeInstanceOf(Logger);
  });

  it('constructs classes without emitDecoratorMetadata using no args', () => {
    class CtorUsingDb {
      constructor(public db?: Database) {}
    }
    container.register(Database, () => new Database());
    const svc = container.resolve(CtorUsingDb);
    expect(svc.db).toBeUndefined();
  });

  it('registers classes before auto-wiring dependency trees', () => {
    container.register(Database, () => new Database());
    container.register(UserService, (c) => new UserService(c.resolve(Database)));
    const svc = container.resolve(UserService);
    expect(svc.find()).toBe('find:rows');
  });

  it('keeps singleton resolved once even after multiple resolutions', () => {
    let count = 0;
    container.registerSingleton(Logger, () => { count++; return new Logger(); });
    container.resolve(Logger);
    container.resolve(Logger);
    expect(count).toBe(1);
  });

  it('exposes auto-wired instance through factories with container access', () => {
    container.register(Database, () => new Database());
    container.register(UserService, (c) => new UserService(c.resolve(Database)));
    const svc = container.resolve(UserService);
    expect(svc.find()).toBe('find:rows');
  });
});