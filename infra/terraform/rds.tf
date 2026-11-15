# PostgreSQL 16 for Kiataker (single source of truth, PRD §28).

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = var.db_subnet_ids
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "Postgres access for the Kiataker app only"
  vpc_id      = var.vpc_id

  ingress {
    description = "Postgres from the app subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = var.db_allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name}-pg"
  engine         = "postgres"
  engine_version = "16"

  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "kiataker"
  username = "kiataker"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  multi_az                = var.environment == "production"
  backup_retention_period = var.environment == "production" ? 14 : 7
  deletion_protection     = var.environment == "production"
  skip_final_snapshot     = var.environment != "production"

  # The restore/backup drill (P5) exercises these automated backups + a PITR restore.
}
