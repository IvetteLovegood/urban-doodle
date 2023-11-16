import React, { Fragment, useEffect, useState } from "react"
import {
  useForm,
  FormItem,
  Input,
  Checkbox,
  Select,
  MultiTimeSelect,
} from "@app/components/Form"
import Icon from "@app/components/Icon"
import Tooltip from "@app/components/Tooltip"
import { Text } from "@app/components/Typography"
import JobRolesField from "./components/JobRolesField"
import JobFormContainer from "../JobFormContainer"
import api, { mutate } from "@app/services/api"
import { checkIfResidentJob, useEnabledJobTypes } from "@app/services/jobHelper"
import { handleApiError } from "@app/utils"
import { useCaniuseFeature } from "@app/utils/hooks"
import { JobDays } from "@app/services/jobHelper"
import { Row, Col } from "@app/components/Layout"

type FormFieldsType = {
  name: string
  abbrev: string
  priority: number
  tigerconnect_integration?: boolean
  tigerconnect_roles?: JobType["tigerconnect_roles"]
  show_empty_assignments?: boolean
  link_to_rotations?: boolean
  overnight_call?: boolean
  overnight_float?: boolean
  starttime: string
  endtime: string
  day_ids: number[] | DayIdWithTimes[]
  day_ids_byday?: Record<string, { starttime: string; endtime: string }>
}

type DayIdWithTimes = {
  dayId: number
  starttime: string
  endtime: string
}

type Props = {
  jobTypeId: number
  job?: JobWithAllFieldsType
  nextSection?: string
}

type DayIdsByDayType = Record<
  number | string,
  { starttime: string; endtime: string }
>

type TimeDefaultsType = Record<string, { starttime: string; endtime: string }>

const linkToRotationsTipMessage =
  "Click this checkbox if you want to link this job to rotations in Block Scheduling calendar(s) in your system, and only assign residents who are assigned to specific rotations. You will need to setup the Linked Rotations for this job separately."

export default (props: Props) => {
  const { jobTypeId: jobTypeIdFromURL, job, nextSection } = props
  const jobTypeId = job?.job_typeid || jobTypeIdFromURL
  const isResidentJob = checkIfResidentJob(jobTypeId)
  const [dayTimes, setDayTimes] = useState(Object)

  const multipleAssignmentsEnabled = useCaniuseFeature("multiple_assignments", {
    scope: "group",
  })

  const calendarV2Enabled = useCaniuseFeature("calendar_v2", {
    scope: "group",
  })

  const enabledJobTypes = useEnabledJobTypes()

  type SubmissionFieldsType = Omit<FormFieldsType, "day_ids"> & {
    day_ids: DayIdsByDayType | typeof dayTimes
  }

  const { control, setValue, watch, handleSubmit } = useForm<FormFieldsType>({
    defaultValues: {
      job_typeid: jobTypeId,
      link_to_rotations: job?.link_to_rotations,
      tigerconnect_integration: job?.tigerconnect_integration,
      tigerconnect_roles: job?.tigerconnect_roles || [],
    },
    schema: (yup) =>
      yup.lazy(() =>
        yup.object().shape({
          name: yup.string().max(80).required().label("Name"),
          abbrev: yup.string().max(20).required().label("Abbreviation"),
          priority: yup
            .number()
            .integer()
            .required("Please enter a priority number for this job")
            .label("Priority"),
          job_typeid: yup.number().label("Job Type").required(),
          tigerconnect_integration: yup.boolean().nullable(),
          tigerconnect_roles: yup
            .array()
            .ensure()
            .of(yup.object())
            .label("TigerConnect Role")
            .when("tigerconnect_integration", {
              is: true,
              then: (schema) =>
                schema.min(1, "Please add at least one tigerconnect role."),
            }),
          show_empty_assignments: yup.boolean().nullable(),
          multiple_assignments: yup.boolean().nullable(),
          link_to_rotations: yup.boolean().nullable(),
          overnight_float: yup.boolean().nullable(),
          overnight_call: yup.boolean().nullable(),
          starttime: yup.string().required().label("Start Time"),
          endtime: yup.string().required().label("End Time"),
          day_ids: yup
            .array()
            .ensure()
            .min(1, "You must select one or more days of the week")
            .required()
            .label("Days to Assign"),
        })
      ),
  })

  const linkToRotations = watch("link_to_rotations")

  useEffect(() => {
    const subscription = watch((fields, { name }) => {
      if (name === "link_to_rotations" && !fields[name]) {
        setValue("overnight_call", false)
        setValue("overnight_float", false)
      }
    })

    return () => subscription.unsubscribe()
  }, [watch])

  const handleDayTimesChange = (newDayTimes: TimeDefaultsType) => {
    setDayTimes(newDayTimes)
  }

  const watchedStartTime = watch('starttime');
  const watchedEndTime = watch('endtime');

  const [multiTimeDefaults] = useState<TimeDefaultsType>(() => {
    return (
      job?.day_types?.reduce(
        (acc, x) => ({
          ...acc,
          [x.dayid.toString()]: {
            starttime: x.starttime ?? job?.starttime ?? "00:00:00",
            endtime: x.endtime ?? job?.endtime ?? "00:00:00",
          },
        }),
        {}
      ) ?? {}
    )
  })

  const submitForm = (
    fields: FormFieldsType,
    handleNextStep: (job: JobWithAllFieldsType) => void
  ) => {
    let submissionFields: SubmissionFieldsType = { ...fields }

    if (!calendarV2Enabled) {
      const dayIdsByDay: DayIdsByDayType = {}
      fields.day_ids.forEach((dayId) => {
        const id = typeof dayId === "number" ? dayId : dayId.dayId
        dayIdsByDay[id] = {
          starttime:
            typeof dayId === "number" ? fields.starttime : dayId.starttime,
          endtime: typeof dayId === "number" ? fields.endtime : dayId.endtime,
        }
      })
      submissionFields.day_ids = dayIdsByDay
    } else {
      submissionFields.day_ids = dayTimes
    }

    if (job) {
      return api
        .updateJob(job.jobid, submissionFields as any)
        .then((updatedJob: JobWithAllFieldsType) => {
          mutate([api.getJob, updatedJob.jobid], updatedJob, false)
          handleNextStep(updatedJob)
        })
        .catch(handleApiError)
    } else {
      return api
        .createJob({ job_typeid: jobTypeId, ...submissionFields })
        .then((newJob: JobWithAllFieldsType) => {
          return api
            .updateJob(newJob.jobid, submissionFields as any)
            .then(() => {
              mutate([api.getJob, newJob.jobid], newJob, false)
              handleNextStep(newJob)
            })
        })
        .catch(handleApiError)
    }
  }

  return (
    <JobFormContainer
      nextSection={nextSection}
      onSubmit={handleSubmit(submitForm as any)}
    >
      <FormItem
        required
        label="Name"
        name="name"
        control={control}
        defaultValue={job?.name}
      >
        <Input />
      </FormItem>
      <FormItem
        required
        label="Abbreviation"
        name="abbrev"
        control={control}
        defaultValue={job?.abbrev}
      >
        <Input />
      </FormItem>
      <FormItem
        required
        label="Priority"
        name="priority"
        control={control}
        defaultValue={job?.priority}
      >
        <Input />
      </FormItem>
      <Fragment>
        <FormItem label="Default Time Job" required>
          <Row>
            <Col>
              <Text bold className="mb-2">
                Start Time
              </Text>
              <Input
                type="time"
                name="starttime"
                control={control}
                defaultValue={job?.starttime || "00:00:00"}
              />
            </Col>
            <Col>
              <Text bold className="mb-2">
                End Time
              </Text>
              <Input
                type="time"
                name="endtime"
                control={control}
                defaultValue={job?.endtime || "00:00:00"}
              />
            </Col>
          </Row>
        </FormItem>
        {calendarV2Enabled ? (
          <FormItem
            label="Days to Assign"
            control={control}
            name="day_ids"
            required
          >
            <MultiTimeSelect
              multiple
              inline
              defaultValue={job?.day_types.map((x) => x.dayid)}
              defaultTimeValues={multiTimeDefaults}
              options={JobDays}
              onDayTimesChange={handleDayTimesChange}
              defaultStartTime={job?.starttime || "00:00:00"}
              defaultEndTime={job?.endtime || "00:00:00"}
            />
          </FormItem>
        ) : (
          <FormItem
            label="Days to Assign"
            control={control}
            name="day_ids"
            required
          >
            <Select
              multiple
              inline
              defaultValue={job?.day_types.map((x) => x.dayid)}
              options={JobDays}
            />
          </FormItem>
        )}
      </Fragment>
      {job && (
        <FormItem required label="Job Type" name="job_typeid" control={control}>
          <Select options={enabledJobTypes} />
        </FormItem>
      )}
      <FormItem
        label="Show Empty Assignments"
        name="show_empty_assignments"
        control={control}
        defaultValue={job?.show_empty_assignments}
      >
        <Checkbox />
      </FormItem>
      {isResidentJob && (
        <>
          <FormItem
            label={
              <div className="d-flex align-items-center">
                <span>Link to Rotations</span>
                <Tooltip title={linkToRotationsTipMessage}>
                  <Text className="d-flex align-items-center ml-2">
                    <Icon hoverable name="question-circle-fill" />
                  </Text>
                </Tooltip>
              </div>
            }
            name="link_to_rotations"
            control={control}
          >
            <Checkbox />
          </FormItem>
          {linkToRotations && (
            <>
              <FormItem
                label="Overnight Float"
                name="overnight_float"
                control={control}
                defaultValue={job?.overnight_float}
              >
                <Checkbox />
              </FormItem>
              <FormItem
                label="Overnight Call"
                name="overnight_call"
                control={control}
                defaultValue={job?.overnight_call}
              >
                <Checkbox />
              </FormItem>
            </>
          )}
        </>
      )}

      {multipleAssignmentsEnabled && (
        <FormItem
          label="Allow Multiple Assignments"
          name="multiple_assignments"
          control={control}
          defaultValue={job?.multiple_assignments}
        >
          <Checkbox />
        </FormItem>
      )}
      <FormItem
        label="Tigerconnect Integration"
        name="tigerconnect_integration"
        control={control}
      >
        <Checkbox />
      </FormItem>
      <FormItem
        name="tigerconnect_roles"
        label="Tigerconnect Roles"
        control={control}
      >
        <JobRolesField />
      </FormItem>
    </JobFormContainer>
  )
}
