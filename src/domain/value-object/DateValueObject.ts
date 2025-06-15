import { ValueObject } from './ValueObject';

export abstract class DateValueObject extends ValueObject<Date> {
	toString(): string {
		return this.value.toISOString();
	}
}
