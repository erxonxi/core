import { DomainEvent } from './DomainEvent';
import { Primitives } from './Primitives';

export abstract class AggregateRoot {
	private domainEvents: Array<DomainEvent>;

	constructor() {
		this.domainEvents = [];
	}

	pullDomainEvents(): Array<DomainEvent> {
		const domainEvents = this.domainEvents.slice();
		this.domainEvents = [];

		return domainEvents;
	}

	record(event: DomainEvent): void {
		this.domainEvents.push(event);
	}

	abstract toPrimitives(): Primitives<AggregateRoot>;
}
