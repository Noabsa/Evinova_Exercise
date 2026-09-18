import { App } from 'aws-cdk-lib';
import { FeedbackIntakeStack } from './feedback-intake-stack';

const app = new App();
new FeedbackIntakeStack(app, 'FeedbackIntakeStack');
