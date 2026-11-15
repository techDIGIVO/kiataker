# Kiataker core infrastructure (PRD P0-03). Scaffold: review before applying.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state: bootstrap this bucket + lock table once, by hand, then uncomment.
  # backend "s3" {
  #   bucket         = "kiataker-tfstate"
  #   key            = "core/terraform.tfstate"
  #   region         = "af-south-1"
  #   dynamodb_table = "kiataker-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = "kiataker"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

locals {
  name = "kiataker-${var.environment}"
}
