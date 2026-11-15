-- CreateEnum
CREATE TYPE "OrganisationKind" AS ENUM ('PLATFORM_OPERATOR', 'PROPERTY_MANAGER');

-- CreateEnum
CREATE TYPE "ParticipantKind" AS ENUM ('LANDLORD', 'REPRESENTATIVE', 'PROVIDER_USER', 'STAFF');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ERASED');

-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "TermsKind" AS ENUM ('TERMS_OF_USE', 'MANDATE', 'PRIVACY_NOTICE');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('PENDING_ACCEPTANCE', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BuildingUse" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE');

-- CreateEnum
CREATE TYPE "UnitUse" AS ENUM ('RESIDENTIAL', 'SHOP', 'OFFICE', 'WAREHOUSE', 'OTHER_BUSINESS');

-- CreateEnum
CREATE TYPE "PropertyState" AS ENUM ('DRAFT', 'MANAGED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('NOT_STARTED', 'IN_REVIEW', 'PASSED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "OccupancyState" AS ENUM ('EXPECTED', 'ACTIVE', 'VACATING', 'VACATED', 'POSSESSION_DISPUTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TenancyRoute" AS ENUM ('EXISTING', 'ORIGINATION');

-- CreateEnum
CREATE TYPE "TenancyManagementState" AS ENUM ('DRAFT', 'MANAGED', 'ENDED');

-- CreateEnum
CREATE TYPE "TenancyLifecyclePhase" AS ENUM ('FUTURE_DATED', 'CURRENT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TenancyStatus" AS ENUM ('RECORDED', 'TENANT_NOTIFIED', 'TENANT_CONFIRMED', 'TENANT_DISPUTED', 'RECONCILED', 'RENEWED', 'ENDED');

-- CreateEnum
CREATE TYPE "TenancyParticipantRole" AS ENUM ('TENANT', 'PERMITTED_OCCUPANT', 'GUARANTOR');

-- CreateEnum
CREATE TYPE "TenantProfileSource" AS ENUM ('LANDLORD_SUPPLIED');

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('LANDLORD', 'TENANT', 'PROVIDER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'AVAILABLE', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING_ON_OTHER_PARTY', 'BLOCKED', 'OVERDUE', 'COMPLETED', 'CANCELLED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ActionPriority" AS ENUM ('CRITICAL', 'URGENT', 'OVERDUE', 'IMPORTANT', 'NORMAL');

-- CreateEnum
CREATE TYPE "SecureTaskPurpose" AS ENUM ('SIGN', 'APPROVE_NOTICE', 'PAYEE_CHANGE', 'CLASS_C_DECISION', 'QUOTE_ABOVE_LIMIT', 'TENANT_CONFIRM');

-- CreateEnum
CREATE TYPE "ControlRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "Organisation" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "kind" "OrganisationKind" NOT NULL,
    "rcNumber" TEXT,
    "lasreraNumber" TEXT,
    "scumlRef" TEXT,
    "address" TEXT,
    "taxIds" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Organisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "kind" "ParticipantKind" NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactPoint" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "valueHash" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "ContactPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactVerificationCode" (
    "id" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "channel" "ContactChannel" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastStepUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsDocument" (
    "id" TEXT NOT NULL,
    "kind" "TermsKind" NOT NULL,
    "organisationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsVersion" (
    "id" TEXT NOT NULL,
    "termsDocumentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "ip" TEXT,
    "device" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAcceptanceVersion" (
    "id" TEXT NOT NULL,
    "acceptanceId" TEXT NOT NULL,
    "termsVersionId" TEXT NOT NULL,

    CONSTRAINT "TermsAcceptanceVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "participantId" TEXT,
    "subjectRef" TEXT,
    "consentType" TEXT NOT NULL,
    "given" BOOLEAN NOT NULL,
    "channel" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandCentre" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandCentre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" TEXT NOT NULL,
    "commandCentreId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatAssignment" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "organisationScope" TEXT NOT NULL,
    "addressNormalised" TEXT NOT NULL,
    "addressRaw" TEXT NOT NULL,
    "type" TEXT,
    "buildingUse" "BuildingUse" NOT NULL,
    "unitUse" "UnitUse",
    "building" TEXT,
    "unit" TEXT,
    "state" "PropertyState" NOT NULL DEFAULT 'DRAFT',
    "operatingState" TEXT,
    "qcStatus" "QcStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "publicSearchOptIn" BOOLEAN NOT NULL DEFAULT false,
    "managedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyParticipant" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "scope" TEXT,
    "authorityEvidence" JSONB,
    "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mandate" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "termsVersionId" TEXT,
    "status" "MandateStatus" NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Mandate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingInstruction" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "limitKobo" BIGINT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingInstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Occupancy" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "state" "OccupancyState" NOT NULL DEFAULT 'EXPECTED',
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Occupancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenancy" (
    "id" TEXT NOT NULL,
    "occupancyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "route" "TenancyRoute" NOT NULL,
    "managementState" "TenancyManagementState" NOT NULL DEFAULT 'DRAFT',
    "lifecyclePhase" "TenancyLifecyclePhase" NOT NULL DEFAULT 'FUTURE_DATED',
    "status" "TenancyStatus" NOT NULL DEFAULT 'RECORDED',
    "commencementDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "acceptedCommencementSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Tenancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyTerm" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "rentKobo" BIGINT NOT NULL,
    "frequency" TEXT NOT NULL,
    "cautionFeeKobo" BIGINT,
    "serviceChargeKobo" BIGINT,
    "noticePeriod" TEXT,
    "rentReviewTerms" TEXT,
    "inspectionTerms" TEXT,
    "breakClause" TEXT,
    "specialTerms" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPoints" JSONB NOT NULL,
    "source" "TenantProfileSource" NOT NULL DEFAULT 'LANDLORD_SUPPLIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyParticipant" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "tenantProfileId" TEXT NOT NULL,
    "role" "TenancyParticipantRole" NOT NULL,
    "liabilityBasis" TEXT,
    "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseTruthAffirmation" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "actorKind" "ActorKind" NOT NULL,
    "answer" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseTruthAffirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenancyAccuracyAcknowledgement" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "landlordId" TEXT NOT NULL,
    "copyVersion" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenancyAccuracyAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalRunway" (
    "id" TEXT NOT NULL,
    "tenancyId" TEXT NOT NULL,
    "lastSafeNoticeDate" TIMESTAMP(3),
    "stage" TEXT NOT NULL,
    "decision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalRunway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceWorkflow" TEXT NOT NULL,
    "sourceRecordRef" TEXT NOT NULL,
    "propertyScope" TEXT,
    "assigneeRef" TEXT,
    "priority" "ActionPriority" NOT NULL DEFAULT 'NORMAL',
    "dueTime" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "controlKey" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "escalationRule" TEXT,
    "openDedupeSlot" TEXT NOT NULL,
    "causedByEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionStatusHistory" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL,
    "actorRef" TEXT,
    "sourceEventId" TEXT,
    "evidenceRef" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionRoutingRule" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "priority" "ActionPriority" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "organisationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "legalBasis" TEXT,
    "counselApprovedBy" TEXT,
    "counselApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenancyId" TEXT,
    "templateVersionId" TEXT,
    "status" TEXT NOT NULL,
    "contentHash" TEXT,
    "authorisedBy" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "serviceDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoticeRecipient" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "providerRef" TEXT,
    "outcome" TEXT,
    "at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoticeRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "canonicalHash" TEXT NOT NULL,
    "sealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecureTask" (
    "id" TEXT NOT NULL,
    "purpose" "SecureTaskPurpose" NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "destinationHash" TEXT NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "documentVersionId" TEXT,
    "documentHash" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "supersededBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecureTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskResponse" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB,
    "device" TEXT,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseRef" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectRef" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "seat" TEXT,
    "reason" TEXT,
    "action" TEXT NOT NULL,
    "objectRef" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "objectRef" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyTimelineEvent" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceRefs" JSONB,
    "contentHash" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformControl" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "parentKey" TEXT,
    "dependencies" JSONB,
    "risk" "ControlRisk" NOT NULL DEFAULT 'LOW',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'all',
    "savedState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingVersion" (
    "id" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "quietHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactPoint_participantId_idx" ON "ContactPoint"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactPoint_channel_valueHash_key" ON "ContactPoint"("channel", "valueHash");

-- CreateIndex
CREATE INDEX "ContactVerificationCode_targetHash_idx" ON "ContactVerificationCode"("targetHash");

-- CreateIndex
CREATE INDEX "Session_participantId_idx" ON "Session"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "TermsVersion_termsDocumentId_version_key" ON "TermsVersion"("termsDocumentId", "version");

-- CreateIndex
CREATE INDEX "TermsAcceptance_participantId_idx" ON "TermsAcceptance"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "TermsAcceptanceVersion_acceptanceId_termsVersionId_key" ON "TermsAcceptanceVersion"("acceptanceId", "termsVersionId");

-- CreateIndex
CREATE INDEX "ConsentRecord_participantId_idx" ON "ConsentRecord"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "CommandCentre_key_key" ON "CommandCentre"("key");

-- CreateIndex
CREATE INDEX "SeatAssignment_participantId_idx" ON "SeatAssignment"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemRole_key_key" ON "SystemRole"("key");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permission_scope_key" ON "RolePermission"("roleId", "permission", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "Property_reference_key" ON "Property"("reference");

-- CreateIndex
CREATE INDEX "Property_organisationScope_idx" ON "Property"("organisationScope");

-- CreateIndex
CREATE INDEX "Property_state_idx" ON "Property"("state");

-- CreateIndex
CREATE INDEX "PropertyParticipant_propertyId_idx" ON "PropertyParticipant"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyParticipant_participantId_idx" ON "PropertyParticipant"("participantId");

-- CreateIndex
CREATE INDEX "Mandate_propertyId_idx" ON "Mandate"("propertyId");

-- CreateIndex
CREATE INDEX "StandingInstruction_propertyId_idx" ON "StandingInstruction"("propertyId");

-- CreateIndex
CREATE INDEX "Occupancy_propertyId_idx" ON "Occupancy"("propertyId");

-- CreateIndex
CREATE INDEX "Tenancy_propertyId_idx" ON "Tenancy"("propertyId");

-- CreateIndex
CREATE INDEX "Tenancy_occupancyId_idx" ON "Tenancy"("occupancyId");

-- CreateIndex
CREATE UNIQUE INDEX "TenancyTerm_tenancyId_version_key" ON "TenancyTerm"("tenancyId", "version");

-- CreateIndex
CREATE INDEX "TenancyParticipant_tenancyId_idx" ON "TenancyParticipant"("tenancyId");

-- CreateIndex
CREATE INDEX "BaseTruthAffirmation_tenancyId_idx" ON "BaseTruthAffirmation"("tenancyId");

-- CreateIndex
CREATE UNIQUE INDEX "BaseTruthAffirmation_tenancyId_number_key" ON "BaseTruthAffirmation"("tenancyId", "number");

-- CreateIndex
CREATE INDEX "TenancyAccuracyAcknowledgement_tenancyId_idx" ON "TenancyAccuracyAcknowledgement"("tenancyId");

-- CreateIndex
CREATE INDEX "RenewalRunway_tenancyId_idx" ON "RenewalRunway"("tenancyId");

-- CreateIndex
CREATE INDEX "Action_status_priority_idx" ON "Action"("status", "priority");

-- CreateIndex
CREATE INDEX "Action_propertyScope_idx" ON "Action"("propertyScope");

-- CreateIndex
CREATE UNIQUE INDEX "Action_openDedupeSlot_key" ON "Action"("openDedupeSlot");

-- CreateIndex
CREATE INDEX "ActionStatusHistory_actionId_idx" ON "ActionStatusHistory"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionRoutingRule_eventType_key" ON "ActionRoutingRule"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "Template_code_key" ON "Template"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateVersion_templateId_version_key" ON "TemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "Notice_propertyId_idx" ON "Notice"("propertyId");

-- CreateIndex
CREATE INDEX "NoticeRecipient_noticeId_idx" ON "NoticeRecipient"("noticeId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_documentId_version_key" ON "DocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "SecureTask_tokenHash_key" ON "SecureTask"("tokenHash");

-- CreateIndex
CREATE INDEX "SecureTask_subjectRef_idx" ON "SecureTask"("subjectRef");

-- CreateIndex
CREATE INDEX "TaskResponse_taskId_idx" ON "TaskResponse"("taskId");

-- CreateIndex
CREATE INDEX "OutboxEvent_publishedAt_idx" ON "OutboxEvent"("publishedAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateRef_idx" ON "OutboxEvent"("aggregateRef");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "ScheduledJob_state_runAt_idx" ON "ScheduledJob"("state", "runAt");

-- CreateIndex
CREATE INDEX "AuditLog_objectRef_idx" ON "AuditLog"("objectRef");

-- CreateIndex
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");

-- CreateIndex
CREATE INDEX "AccessLog_objectRef_idx" ON "AccessLog"("objectRef");

-- CreateIndex
CREATE INDEX "PropertyTimelineEvent_propertyId_idx" ON "PropertyTimelineEvent"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformControl_key_key" ON "PlatformControl"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateIndex
CREATE INDEX "SettingVersion_settingId_idx" ON "SettingVersion"("settingId");

-- CreateIndex
CREATE INDEX "NotificationPreference_participantId_idx" ON "NotificationPreference"("participantId");

-- CreateIndex
CREATE INDEX "PushDevice_participantId_idx" ON "PushDevice"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "CopyEntry_key_locale_version_key" ON "CopyEntry"("key", "locale", "version");

-- AddForeignKey
ALTER TABLE "ContactPoint" ADD CONSTRAINT "ContactPoint_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsVersion" ADD CONSTRAINT "TermsVersion_termsDocumentId_fkey" FOREIGN KEY ("termsDocumentId") REFERENCES "TermsDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptanceVersion" ADD CONSTRAINT "TermsAcceptanceVersion_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "TermsAcceptance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptanceVersion" ADD CONSTRAINT "TermsAcceptanceVersion_termsVersionId_fkey" FOREIGN KEY ("termsVersionId") REFERENCES "TermsVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandCentre" ADD CONSTRAINT "CommandCentre_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_commandCentreId_fkey" FOREIGN KEY ("commandCentreId") REFERENCES "CommandCentre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAssignment" ADD CONSTRAINT "SeatAssignment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "SystemRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organisationScope_fkey" FOREIGN KEY ("organisationScope") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyParticipant" ADD CONSTRAINT "PropertyParticipant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyParticipant" ADD CONSTRAINT "PropertyParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mandate" ADD CONSTRAINT "Mandate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingInstruction" ADD CONSTRAINT "StandingInstruction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Occupancy" ADD CONSTRAINT "Occupancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_occupancyId_fkey" FOREIGN KEY ("occupancyId") REFERENCES "Occupancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenancy" ADD CONSTRAINT "Tenancy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyTerm" ADD CONSTRAINT "TenancyTerm_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyParticipant" ADD CONSTRAINT "TenancyParticipant_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyParticipant" ADD CONSTRAINT "TenancyParticipant_tenantProfileId_fkey" FOREIGN KEY ("tenantProfileId") REFERENCES "TenantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseTruthAffirmation" ADD CONSTRAINT "BaseTruthAffirmation_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenancyAccuracyAcknowledgement" ADD CONSTRAINT "TenancyAccuracyAcknowledgement_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalRunway" ADD CONSTRAINT "RenewalRunway_tenancyId_fkey" FOREIGN KEY ("tenancyId") REFERENCES "Tenancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionStatusHistory" ADD CONSTRAINT "ActionStatusHistory_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoticeRecipient" ADD CONSTRAINT "NoticeRecipient_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "Notice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskResponse" ADD CONSTRAINT "TaskResponse_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "SecureTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyTimelineEvent" ADD CONSTRAINT "PropertyTimelineEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingVersion" ADD CONSTRAINT "SettingVersion_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "Setting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
