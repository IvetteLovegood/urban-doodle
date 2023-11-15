import React, {
  useState,
  useReducer,
  useEffect,
  useMemo,
  useRef,
  Fragment,
} from "react"
import { useMountedEffect } from "@app/utils/hooks"
import Dropdown from "@app/components/Dropdown"
import Icon from "@app/components/Icon"
import Button from "@app/components/Button"
import Loader from "@app/components/Loader"
import { isIE } from "@app/utils"
import SafeAnchor from "react-bootstrap/SafeAnchor"
import { UseControlProps, useControl } from "./useForm"
import { get as lodashGet } from "lodash"
import cx from "classnames"
import css from "./MultiSelectWithTime.module.scss"
import TimePickerInput from "./TimePickerInput"
type TimePickerInputProps = React.ComponentProps<typeof TimePickerInput>

interface MultiTimeSelect extends UseControlProps {
  inline?: boolean
  multiple?: boolean
  clearable?: boolean
  searchable?: boolean
  options: PlainObjectType[]
  valueKey?: keyof MultiTimeSelect["options"][number]
  labelKey?: keyof MultiTimeSelect["options"][number]
  value?: (number | string)[] | number | string
  placeholder?: string
  loading?: boolean
  separator?: string | React.ReactNode
  renderOption?: (text: any, item?: any) => React.ReactNode
  enableHelpers?: boolean
  className?: string
  onInputChange?: (text: string) => any
  timePickerProps?: TimePickerInputProps["timePickerProps"]
  defaultTimeValues?: { [key: string]: { starttime: string; endtime: string } }
  defaultStartTime?: string
  defaultEndTime?: string
  onDayTimesChange: (dayTimes: {[key: string]: { starttime: string; endtime: string }}) => void
}
interface DayTimes {
  [key: string]: { starttime: string; endtime: string }
}

export default ((props: MultiTimeSelect) => {
  const {
    inline = false,
    multiple = false,
    clearable = true,
    searchable,
    options,
    valueKey = "id",
    labelKey = "name",
    value,
    defaultValue,
    loading = false,
    placeholder,
    separator = "/",
    renderOption,
    enableHelpers = true,
    className,
    disabled,
    error,
    onChange,
    onInputChange,
  } = useControl(props)

  const [values, updateValues] = useReducer(
    (
      state: Array<number | string>,
      action: { type?: string; payload?: any }
    ) => {
      const newValue = action.payload
      if (multiple) {
        if (action.type == "replace") return [...newValue]
        else if (action.type == "pop") return state.slice(0, -1)
        else
          return state.indexOf(newValue) >= 0
            ? state.filter((x) => x !== newValue)
            : [...state, newValue]
      } else {
        return [newValue]
      }
    },
    defaultValue !== undefined ? (multiple ? defaultValue : [defaultValue]) : []
  )
  const [dayTimes, setDayTimes] = useState<DayTimes>(props.defaultTimeValues || {});
  const [dropdownShow, setDropdownShow] = useState(false)
  const [searchText, setSearchText] = useState("")
  const searchInput = useRef<any>()

  function handleTimeChange(optionValue: string | number,timeStr?: string,type?: "starttime" | "endtime") {
    console.log("change:::::", props.onDayTimesChange)
    setDayTimes((prevDayTimes) => {
      console.log(prevDayTimes, "prevDayTimes")
      const newDayTimes = { ...prevDayTimes }
      if (!newDayTimes[optionValue]) {
        console.log("props.defaultStartTime", props.defaultStartTime)
        newDayTimes[optionValue] = {
          starttime: props.defaultStartTime || "00:00:00",
          endtime: props.defaultEndTime || "00:00:00",
        }
      }
      if (type === "starttime") {
        newDayTimes[optionValue].starttime =
          timeStr || newDayTimes[optionValue].starttime
      } else if (type === "endtime") {
        newDayTimes[optionValue].endtime =
          timeStr || newDayTimes[optionValue].endtime
      }
      setDayTimes((prevDayTimes) => {
        return newDayTimes
      })
      props.onDayTimesChange(newDayTimes)
      console.log("props.onDayTimesChange",newDayTimes )
      return newDayTimes
    })
  }

  useEffect(() => {
    // Si props.defaultTimeValues es undefined, inicializa dayTimes con un objeto vacío
    setDayTimes(props.defaultTimeValues || {});
}, [props.defaultTimeValues]);

  useMountedEffect(() => {
    onChange?.(multiple ? values : values[0])
  }, [[values].join()])

  useEffect(() => {
    updateValues({
      type: "replace",
      payload: multiple ? value || [] : value,
    })
  }, [[value].join()])

  useEffect(() => {
    if (!values.length && defaultValue) {
      updateValues({
        type: "replace",
        payload: multiple ? defaultValue : [defaultValue],
      })
    }
  }, [])

  const labelOf = (item: PlainObjectType) => lodashGet(item, labelKey)
  const valueOf = (item: PlainObjectType) => lodashGet(item, valueKey)

  const clearAll = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation()
    updateValues({
      type: "replace",
      payload: multiple ? [] : undefined,
    })
  }
  const selectAll = () => {
    updateValues({
      type: "replace",
      payload: options
        .filter((x) => x.disabled !== true)
        .map((x) => valueOf(x)),
    })
  }

  const handleOptionSelect = (optionValue: any) => {
    console.log("ESTE KE", {payload: optionValue})
    updateValues({ payload: optionValue })
    if (values.includes(optionValue)) {
      setDayTimes((prevDayTimes) => {
        const newDayTimes = { ...prevDayTimes }
        delete newDayTimes[optionValue]
        props.onDayTimesChange(newDayTimes)
        return newDayTimes
      })
    }
    searchable && setSearchText("")
  }

  const SelectOption = useMemo(() => {
    return inline
      ? ({ active, className, eventKey, ...rest }: PlainObjectType) => (
          <SafeAnchor
            {...rest}
            className={cx(className, "dropdown-item", { active })}
          />
        )
      : Dropdown.Item
  }, [inline])

  const errorClassNames = cx({ "bootstrap4 is-invalid": error })
  const filteredOptions =
    searchable && Boolean(searchText)
      ? options.filter((option) =>
          labelOf(option).toLowerCase().includes(searchText.toLowerCase())
        )
      : options
  const selectMenuContent = !filteredOptions?.length ? (
    loading ? (
      <div className="d-flex justify-content-center p-4">
        <Loader variant="secondary" />
      </div>
    ) : (
      <div className="text-center">No available options</div>
    )
  ) : (
    filteredOptions.map((option, idx) => {
      const optionValue = valueOf(option)
      const active = values.indexOf(optionValue) >= 0
      const optionText = labelOf(option) || optionValue
      const optionTime = dayTimes[optionValue] || {}

      return (
        <div key={idx} className={css.selectItemContainer}>
          <SelectOption
            className={cx("d-flex align-items-center", css.selectItem, {
              [css.selectItemDisabled]: disabled || option.disabled,
            })}
            active={active}
            eventKey={
              optionValue != null ? optionValue.toString() : optionValue
            }
          >
            <div
              onClick={() => handleOptionSelect(optionValue)}
              className={cx("flex-fill text-truncate", css.selectItemText)}
            >
              {renderOption?.(optionText, option) || optionText}
            </div>
            {inline && active && (
              <Fragment>
                <div className={css.timePickers}>
                  <TimePickerInput
                    placeholder="Start Time"
                    value={
                      optionTime.starttime ||
                      props.defaultStartTime ||
                      "00:00:00"
                    }
                    onTimeChange={(timeStr) =>
                      handleTimeChange(optionValue, timeStr, "starttime")
                    }
                    {...props.timePickerProps}
                  />
                </div>
                <span className={css.spanPickers}>to</span>
                <div className={css.timePickers}>
                  <TimePickerInput
                    placeholder="End Time"
                    value={
                      optionTime.endtime || props.defaultEndTime || "00:00:00"
                    }
                    onTimeChange={(timeStr) =>
                      handleTimeChange(optionValue, timeStr, "endtime")
                    }
                    {...props.timePickerProps}
                  />
                </div>
              </Fragment>
            )}
            <div
              onClick={() => handleOptionSelect(optionValue)}
              className={css.selectCheckIcon}
            >
              {active && <Icon name="check" />}
            </div>
          </SelectOption>
        </div>
      )
    })
  )

  if (inline) {
    return (
      <div
        className={cx(css.select, className, { [css.selectInline]: inline })}
      >
        <div className={cx(css.selectMenu, errorClassNames)}>
          {selectMenuContent}
        </div>
        {multiple && !disabled && enableHelpers && (
          <div className={css.selectFunctions}>
            <Button
              shape="pill"
              onClick={selectAll}
              variant="light"
              size="xs"
              className="mr-4"
            >
              Select All
            </Button>
            <Button shape="pill" onClick={clearAll} variant="light" size="xs">
              Clear
            </Button>
          </div>
        )}
        <div className="invalid-tooltip">{error?.message}</div>
      </div>
    )
  }

  const handleDropdownToggle = (newStatus: boolean) => {
    setDropdownShow(newStatus)
    searchable && setSearchText("")
    if (newStatus && searchable) {
      searchInput.current?.focus()
    }
  }

  // const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const text = event.currentTarget.value
  //   setSearchText(text)
  //   onInputChange?.(text)
  // }

  // const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
  //   if (multiple && searchable && !searchText && event.keyCode === 8) {
  //     updateValues({ type: "pop" })
  //   }
  // }

  const selectedOptions = values.reduce((acc: PlainObjectType[], val) => {
    const item = (options || []).find((x) => valueOf(x) === val)
    return item ? [...acc, item] : acc
  }, [])

  const selectSeparator =
    typeof separator === "string" ? (
      <div className={css.selectSeparator}>{separator}</div>
    ) : (
      separator
    )

  return (
    <Dropdown
      variant="formSelect"
      onToggle={handleDropdownToggle}
      className={cx(
        css.select,
        { [css.selectSearchable]: searchable },
        className
      )}
      show={dropdownShow}
      overlay={
        !disabled && (
          <Dropdown.Menu
            keepUniformWidth
            className={cx(css.selectMenu, {
              [css.selectForceLeft]: isIE,
            })}
            children={selectMenuContent}
          />
        )
      }
    >
      <div className={cx(css.selectToggle, errorClassNames)}>
        <div className="d-flex flex-fill align-items-center">
          {/* {searchable && (
            <input
              type="text"
              ref={searchInput}
              value={searchText}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              className={cx(css.selectSearchInput, {
                [css.pullSearchInputRight]: multiple && values?.length,
              })}
              style={{
                width: Boolean(searchText)
                  ? `${searchText.length + 2}ch`
                  : "1px",
              }}
            />
          )} */}
          <div className="d-flex align-items-center mr-1">
            {loading
              ? !searchText && <div>Loading...</div>
              : (multiple ? values?.length : values[0] != null)
              ? (multiple || (!multiple && !searchText)) &&
                selectedOptions.map((option, idx) => (
                  <React.Fragment key={idx}>
                    {idx !== 0 && selectSeparator}
                    <div>{labelOf(option)}</div>
                  </React.Fragment>
                ))
              : !searchText && (
                  <div>
                    {placeholder ||
                      (multiple ? "Multi-select..." : "Select...")}
                  </div>
                )}
          </div>
        </div>
        {!disabled && (
          <>
            {values[0] != null && clearable && (
              <Icon
                name="close"
                className={css.clearSelect}
                onClick={clearAll}
              />
            )}
            <Icon name={dropdownShow ? "chevron-up" : "chevron-down"} />
          </>
        )}
      </div>
      <div className="invalid-tooltip">{error?.message}</div>
    </Dropdown>
  )
}) as React.FC<MultiTimeSelect>
