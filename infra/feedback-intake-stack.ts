import { CfnOutput, Duration, Fn, RemovalPolicy, Stack } from 'aws-cdk-lib';
import type { StackProps } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { BlockPublicAccess, Bucket } from 'aws-cdk-lib/aws-s3';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';

const stackDirectory = fileURLToPath(new URL('.', import.meta.url));

/**
 * How this service would be provisioned. Synthesised, never deployed.
 *
 * No datastore, on purpose: records live in a Map. On Lambda that state belongs
 * to one execution environment, so it lasts only while a container stays warm
 * and concurrent invocations do not share it.
 */
export class FeedbackIntakeStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The model key lives in Secrets Manager. The function receives the ARN and
    // the permission to read it, never the value: nothing puts the key in an
    // environment variable, where it would show in the console and the template.
    const modelKey = Secret.fromSecretNameV2(this, 'ModelKey', 'feedback-intake/anthropic-api-key');

    const feedbackApiFunction = new NodejsFunction(this, 'FeedbackApiFunction', {
      entry: `${stackDirectory}../src/lambda.ts`,
      handler: 'handler',
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      // Comfortably above the model call's own 20s abort, so the service decides
      // the timeout rather than the platform cutting the request short.
      timeout: Duration.seconds(30),
      environment: { ANTHROPIC_SECRET_ARN: modelKey.secretArn },
      logGroup: new LogGroup(this, 'FeedbackApiFunctionLogs', {
        // How long logs are kept is a records decision, not a framework default.
        retention: RetentionDays.FIVE_YEARS,
        removalPolicy: RemovalPolicy.RETAIN,
      }),
    });
    modelKey.grantRead(feedbackApiFunction);

    // No authorizer: a non-goal here, but this endpoint triggers a paid model
    // call, so it needs auth and rate limiting before facing the internet.
    const feedbackApi = new HttpApi(this, 'FeedbackApi', {
      defaultIntegration: new HttpLambdaIntegration('FeedbackApiIntegration', feedbackApiFunction),
    });

    // Private, reachable only through the distribution. Unlike the logs it is
    // destroyed with the stack: a pipeline publishes here what the repo rebuilds.
    const dashboardBucket = new Bucket(this, 'DashboardBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // One domain for the browser: the bucket serves the dashboard and /api/* goes
    // to the HTTP API. Same origin, so no CORS anywhere and the client keeps the
    // relative paths the dev server's proxy already gives it.
    const dashboardDistribution = new Distribution(this, 'DashboardDistribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(dashboardBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(Fn.parseDomainName(feedbackApi.apiEndpoint)),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          // Answers are per-submission and must not be served from an edge cache.
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
    });

    new CfnOutput(this, 'DashboardUrl', { value: `https://${dashboardDistribution.distributionDomainName}` });
  }
}
