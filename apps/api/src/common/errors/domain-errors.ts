import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorCode } from "@kiataker/contracts";

/** Domain error carrying a stable error code (§42). The filter renders one error shape. */
export class DomainError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly extra?: unknown,
  ) {
    super({ code, message, details: extra }, status);
  }
}

export class ValidationFailed extends DomainError {
  constructor(details: unknown) {
    super(ErrorCode.VALIDATION_FAILED, "Validation failed", HttpStatus.BAD_REQUEST, details);
  }
}
export class Unauthenticated extends DomainError {
  constructor(message = "Authentication required") {
    super(ErrorCode.UNAUTHENTICATED, message, HttpStatus.UNAUTHORIZED);
  }
}
export class Forbidden extends DomainError {
  constructor(message = "Not permitted") {
    super(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}
export class NotFound extends DomainError {
  constructor(message = "Not found") {
    super(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }
}
export class Conflict extends DomainError {
  constructor(message = "Conflict", extra?: unknown) {
    super(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT, extra);
  }
}
export class ControlDisabled extends DomainError {
  constructor(controlKey: string) {
    super(
      ErrorCode.CONTROL_DISABLED,
      `This feature is switched off (${controlKey})`,
      HttpStatus.FORBIDDEN,
      { controlKey },
    );
  }
}
export class GateNotSatisfied extends DomainError {
  constructor(gate: string) {
    super(ErrorCode.GATE_NOT_SATISFIED, `A required step is not complete (${gate})`, HttpStatus.CONFLICT, { gate });
  }
}
export class BaseTruthNotConfirmed extends DomainError {
  constructor() {
    super(
      ErrorCode.BASE_TRUTH_NOT_CONFIRMED,
      "The tenant has not confirmed this record yet",
      HttpStatus.CONFLICT,
    );
  }
}
/** A UI attempt to complete an action returns 409 (ACT-04). */
export class ActionNotClosableFromUi extends DomainError {
  constructor() {
    super(
      ErrorCode.CONFLICT,
      "An action closes only from a qualifying source event, never from a click",
      HttpStatus.CONFLICT,
    );
  }
}
