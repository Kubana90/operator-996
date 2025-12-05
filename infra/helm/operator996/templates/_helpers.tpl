{{/*
Expand the name of the chart.
*/}}
{{- define "operator996.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "operator996.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "operator996.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "operator996.labels" -}}
helm.sh/chart: {{ include "operator996.chart" . }}
{{ include "operator996.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "operator996.selectorLabels" -}}
app.kubernetes.io/name: {{ include "operator996.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "operator996.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "operator996.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the proper image name
*/}}
{{- define "operator996.image" -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion -}}
{{- printf "%s:%s" .Values.image.repository $tag -}}
{{- end }}

{{/*
Return the database host
*/}}
{{- define "operator996.databaseHost" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "operator996.fullname" .) -}}
{{- else }}
{{- .Values.externalDatabase.host -}}
{{- end }}
{{- end }}

{{/*
Return the redis host
*/}}
{{- define "operator996.redisHost" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "operator996.fullname" .) -}}
{{- else }}
{{- .Values.externalRedis.host -}}
{{- end }}
{{- end }}

{{/*
Return the ConfigMap name
*/}}
{{- define "operator996.configMapName" -}}
{{- printf "%s-config" (include "operator996.fullname" .) -}}
{{- end }}

{{/*
Return the Secret name
*/}}
{{- define "operator996.secretName" -}}
{{- printf "%s-secrets" (include "operator996.fullname" .) -}}
{{- end }}
