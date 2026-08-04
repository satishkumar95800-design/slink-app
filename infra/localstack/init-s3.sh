#!/bin/bash
set -e

echo "Creating S3 buckets..."
awslocal s3 mb s3://slink-assets
awslocal s3 mb s3://slink-receipts

# Public read for branding assets (logos, covers)
awslocal s3api put-bucket-policy --bucket slink-assets --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::slink-assets/public/*"
  }]
}'

echo "S3 buckets created."
