import { EventEmitter } from 'events';

export type DomainEvent =
  | { type: 'stage.entered'; applicationId: string; stage: string; by: string }
  | { type: 'action.executed'; applicationId: string; action: string; by: string }
  | { type: 'ai.assessment.completed'; applicationId: string; stage: string };

class DomainEventBus extends EventEmitter {
  emitEvent(event: DomainEvent) {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[domain-event]', JSON.stringify(event));
    }
    this.emit(event.type, event);
  }
}

export const domainEvents = new DomainEventBus();
