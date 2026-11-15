/**
 * Explicit state machines (PRD §41.4). Every lifecycle is an explicit machine with
 * allowed transitions, guards and side effects. An illegal transition is refused and
 * recorded with actor, reason and attempted state. Machines are shared for display.
 */

export interface Transition<S extends string, E extends string> {
  from: S;
  event: E;
  to: S;
}

export class IllegalTransitionError extends Error {
  constructor(
    public readonly machine: string,
    public readonly from: string,
    public readonly event: string,
  ) {
    super(`Illegal transition in ${machine}: cannot ${event} from ${from}`);
    this.name = "IllegalTransitionError";
  }
}

export class StateMachine<S extends string, E extends string> {
  private readonly table: Map<string, S>;

  constructor(
    public readonly name: string,
    public readonly initial: S,
    public readonly transitions: ReadonlyArray<Transition<S, E>>,
  ) {
    this.table = new Map(transitions.map((t) => [`${t.from}::${t.event}`, t.to]));
  }

  can(from: S, event: E): boolean {
    return this.table.has(`${from}::${event}`);
  }

  /** Returns the next state, or throws IllegalTransitionError (recorded by the caller). */
  next(from: S, event: E): S {
    const to = this.table.get(`${from}::${event}`);
    if (to === undefined) throw new IllegalTransitionError(this.name, from, event);
    return to;
  }

  statesFrom(from: S): E[] {
    return this.transitions.filter((t) => t.from === from).map((t) => t.event);
  }
}
