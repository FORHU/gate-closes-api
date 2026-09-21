import { ConversationType, IEligibilityStrategy } from "./conversation.types";
import { ParallelSoulStrategy } from "./strategies/parallel.soul.strategy";
import { DestinationThreadStrategy } from "./strategies/destination.thread.strategy";
import { BatonTouchStrategy } from "./strategies/baton.touch.strategy";

export class EligibilityFactory {
  private static readonly strategies: Record<ConversationType, IEligibilityStrategy> = {
    parallel_soul: new ParallelSoulStrategy(),
    destination_thread: new DestinationThreadStrategy(),
    baton_touch: new BatonTouchStrategy(),
  };

  static getStrategy(type: ConversationType): IEligibilityStrategy {
    const strategy = this.strategies[type];
    if (!strategy) {
      throw new Error(`Unsupported conversation type: ${type}`);
    }
    return strategy;
  }
}
