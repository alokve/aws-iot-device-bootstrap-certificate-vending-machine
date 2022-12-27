import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_apigateway as apigateway } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_iot as iot } from 'aws-cdk-lib';
import { aws_dynamodb as dynamodb } from 'aws-cdk-lib';
import { aws_iam as iam } from 'aws-cdk-lib';
import { PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class AwsIotDeviceBootstrapCertificateVendingMachineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // IOT device policy document to allow device to interact to AWS IOT
    const iotPolicyDocument = {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": "iot:Connect",
          "Resource": "*"
        },
        {
          "Effect": "Allow",
          "Action": "iot:Subscribe",
          "Resource": [
            "arn:aws:iot:*:*:topicfilter/comm/${iot:Connection.Thing.ThingName}",
            "arn:aws:iot:eu-west-1:124346920228:topicfilter/sdk/test/java",
            "arn:aws:iot:eu-west-1:124346920228:topicfilter/sdk/test/Python",
            "arn:aws:iot:eu-west-1:124346920228:topicfilter/topic_1",
            "arn:aws:iot:eu-west-1:124346920228:topicfilter/topic_2"
          ]
        },
        {
          "Effect": "Allow",
          "Action": [
            "iot:Receive",
            "iot:Publish",
            "iot:RetainPublish"
          ],
          "Resource": [
            "arn:aws:iot:*:*:topic/comm/${iot:Connection.Thing.ThingName}",
            "arn:aws:iot:eu-west-1:124346920228:topic/sdk/test/java",
            "arn:aws:iot:eu-west-1:124346920228:topic/sdk/test/Python",
            "arn:aws:iot:eu-west-1:124346920228:topic/topic_1",
            "arn:aws:iot:eu-west-1:124346920228:topic/topic_2"
          ]
        }
      ]
    };

    // Create IOT Policy
    const iotPolicy = new iot.CfnPolicy(this, 'SingleDevicePolicy', {
      policyDocument: iotPolicyDocument,
      // the properties below are optional
      //policyName: 'SingleDevicePolicy',
    });

    // create dynamodb table to store Device Provisioning Info
    const table = new dynamodb.Table(this, 'DeviceProvisioningInfoDB', {
      partitionKey: { name: 'device_uid', type: dynamodb.AttributeType.STRING },
    });

    // Create Lambda execution role Policy and Role
    // Grant access for Dynamodb Table for validation of device Token
    // Grant IOT actions to onboard device after success validation like Create Keys and certificate, Create Device Thing, Attaching policy to device Certificate
    // Cloudwatch access to create logs group, log stream and put lambda log events
    const lambdaPolicyDocument = new PolicyDocument();
    lambdaPolicyDocument.addStatements(new PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "dynamodb:Query",
        "dynamodb:UpdateItem"
      ],
      resources: [
        table.tableArn
      ]
    }), new PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "iot:CreateKeysAndCertificate",
        "iot:AttachPolicy",
        "iot:CreateThing",
        "iot:AttachThingPrincipal",
        "iot:DescribeEndpoint"
      ],
      resources: ['*']
    }), new PolicyStatement({
      actions: [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      resources: ["arn:aws:logs:*:*:*"],
      effect: iam.Effect.ALLOW
    }));

    const lambdaRole = new iam.Role(this, 'registrationLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: { lambdaPolicy: lambdaPolicyDocument }
    });


    //Create registration Lambda Function
    const registrationLambda = new lambda.Function(this, "RegistrationHandler", {
      runtime: lambda.Runtime.PYTHON_3_9,
      code: lambda.Code.fromAsset("resources/lambda"),
      handler: "registration.lambda_handler",
      role: lambdaRole,
      environment: {
        device_dynamodb_table: table.tableName,
        iot_root_ca_url: 'https://www.amazontrust.com/repository/AmazonRootCA1.pem',
        region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION || '',
        thing_name_format: 'thing_%DEVICE_UID%',
        iot_policy_name: iotPolicy.attrId || ''
      }
    });

    // Create API Gateway for Certificate Vending Machine
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'IoTCVMApi',
    });

    // Create one resource (Registration) as endpoint /registration on root
    const registration = api.root.addResource("registration");
    // Create one method (POST) for the resource
    const registrationPOST = registration.addMethod('POST',
      new apigateway.LambdaIntegration(registrationLambda, {
        proxy: false, integrationResponses: [
          { statusCode: '200' }
        ]
      }),
      {
        methodResponses: [
          { statusCode: '200', responseModels: { "application/json": apigateway.Model.EMPTY_MODEL } },
        ]

      });

  }
}
