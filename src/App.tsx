import { useEffect, useReducer, useRef, useState } from "react"
import ReactDOM from "react-dom"

import Action from "./Action"
import RotationContainer from "./Rotation"
import { listenToACT, getHost } from "./ACTListener"
import { LINE_ID, LogCode, ACTION_IDS } from "./constants"

import "./css/App.css"

const handleCodes = new Set([
  LINE_ID.LogLine,
  LINE_ID.ChangeZone,
  LINE_ID.ChangePrimaryPlayer,
  LINE_ID.NetworkStartsCasting,
  LINE_ID.NetworkAbility,
  LINE_ID.NetworkAOEAbility,
  LINE_ID.NetworkCancelAbility,
  LINE_ID.ActorControl,
])

type Action = {
  key: string
  actionId: number
  ability: string
  casting: boolean
}

type Encounter = {
  name: string
  actionList: Array<{ actionId: number; ability: string }>
}

export default function App() {
  const [actionList, setActionList] = useState<Action[]>([])
  const [encounterList, setEncounterList] = useState<Encounter[]>([])

  const [reconnectionToken, reconnect] = useReducer((x) => x + 1, 0)

  const ref = useRef<"idle" | "closed" | "opened">("idle")
  const [status, setStatus] = useState<typeof ref.current>("idle")

  useEffect(() => {
    let selfId: number | undefined
    let lastTimestamp = ""
    let currentZone = "Unknown"

    let timeoutId: number | undefined = undefined

    const closeFn = listenToACT({
      onopen: () => {
        setStatus("opened")
        ref.current = "opened"
      },
      onclose: () => {
        setStatus("closed")
        ref.current = "closed"

        setTimeout(() => {
          if (ref.current === "closed") {
            reconnect()
          }
        }, 500)
      },

      onmessage: (eventData) => {
        const openNewEncounter = () => {
          setEncounterList((encounterList) => {
            if (
              encounterList[0] &&
              encounterList[0].actionList &&
              encounterList[0].actionList.length <= 0
            ) {
              encounterList.shift()
            }

            encounterList.unshift({
              name: currentZone,
              actionList: [],
            })

            return encounterList.slice(0, 3)
          })
        }

        if (eventData.msgtype === "SendCharName") {
          selfId = eventData.msg.charID
          openNewEncounter()
          return
        }

        if (eventData.msgtype === "Chat") {
          const logSplit = eventData.msg.split("|")

          const [
            logCode,
            logTimestamp,
            logParameter1,
            logParameter2,
            logParameter3,
            ability,
          ] = logSplit

          if (!handleCodes.has(logCode as LogCode)) return

          switch (logCode) {
            case LINE_ID.LogLine:
              if (logParameter1 === "0038" && logParameter3 === "end")
                openNewEncounter()
              return
            case LINE_ID.ChangeZone:
              currentZone = logParameter2
              return
            case LINE_ID.ChangePrimaryPlayer:
              selfId = parseInt(logParameter1, 16)
              openNewEncounter()
              return
            case LINE_ID.ActorControl:
              if (logParameter2 === "40000012" || logParameter2 === "40000010")
                openNewEncounter()
              return
            default:
              break
          }

          if (selfId === undefined) return

          if (parseInt(logParameter1, 16) !== selfId) return

          const actionId = parseInt(logParameter3, 16)

          const isCombatAction =
            (actionId >= 9 && actionId <= 40000) ||
            actionId === ACTION_IDS.Sprint
          const isCraftingAction = actionId >= 100001 && actionId <= 100300
          const isBugOrDuplicate = logTimestamp === lastTimestamp
          const isItem = ability.startsWith("item_")

          if (
            (!isCombatAction && !isCraftingAction && !isItem) ||
            isBugOrDuplicate
          ) {
            return
          }

          if (Date.now() - Date.parse(lastTimestamp) > 120000) {
            openNewEncounter() // last action > 120s ago
          }

          lastTimestamp = logTimestamp

          const key = logTimestamp

          ReactDOM.flushSync(() => {
            setActionList((actionList) => {
              const lastAction = actionList.at(-1)

              if (logCode === LINE_ID.NetworkCancelAbility) {
                return actionList.slice(0, -1)
              } else if (
                lastAction?.actionId === actionId &&
                lastAction?.casting
              ) {
                const nextActionList = actionList.slice()
                nextActionList[nextActionList.length - 1].casting = false
                return nextActionList
              } else {
                return actionList.concat({
                  actionId,
                  ability,
                  key,
                  casting: logCode === LINE_ID.NetworkStartsCasting,
                })
              }
            })

            setEncounterList((encounterList) => {
              if (logCode !== LINE_ID.NetworkAbility) return encounterList

              if (!encounterList[0]) {
                encounterList[0] = {
                  name: currentZone,
                  actionList: [],
                }
              }

              encounterList[0].actionList.push({ actionId, ability })

              return encounterList
            })
          })

          timeoutId = window.setTimeout(() => {
            setActionList((actionList) =>
              actionList.filter((action) => action.key !== key),
            )
          }, 10000)
        }
      },
    })

    return () => {
      closeFn()
      clearTimeout(timeoutId)
    }
  }, [reconnectionToken])

  return (
    <div className="container">
      <div className="actions">
        {status === "closed" && (
          <div className="error">
            Couldn't connect to OverlayPlugin on {getHost()}
          </div>
        )}

        {actionList.map(({ actionId, ability, key, casting }) => (
          <Action
            key={key}
            actionId={actionId}
            ability={ability}
            casting={casting}
            additionalClasses="action-move"
          />
        ))}
      </div>
      <div style={{ display: 'none' }}>
      {encounterList.map((encounter, i) => (
        <RotationContainer
          key={i}
          encounterId={i}
          name={encounter.name}
          actionList={encounter.actionList}
        />
      ))}
      </div>
    </div>
  )
}
