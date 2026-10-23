import { ActionItem } from './ActionItem.js';
import { Insight } from './Insight.js';

export type MissionControlSchema = {
  ActionItem: ActionItem;
  Insight: Insight;
};

export const schema = [ActionItem, Insight];
