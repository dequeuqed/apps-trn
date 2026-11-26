import {
  BadRequestException,
  HttpStatus,
  StandardSchemaValidationPipe,
} from '@nestjs/common';

export interface FieldError {
  field: string | null;
  message: string;
}

export interface ValidationErrorResponse {
  statusCode: HttpStatus.BAD_REQUEST;
  error: 'Bad Request';
  message: 'Validation failed';
  errors: FieldError[];
}

export function createValidationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: (issues) => {
      const body: ValidationErrorResponse = {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Validation failed',
        errors: issues.map((issue) => ({
          field: issue.path?.length
            ? issue.path
                .map((segment) =>
                  String(typeof segment === 'object' ? segment.key : segment),
                )
                .join('.')
            : null,
          message: issue.message,
        })),
      };
      return new BadRequestException(body);
    },
  });
}
