import React from "react"
import "./css/Action.css"
import { ACTION_IDS } from "./constants"

const gcdOverrides = new Set([
  15997, //standard step
  15998, //technical step
  15999,
  16000,
  16001,
  16002, //step actions
  16003, //standard finish
  16004, //technical finish
  16191, //single standard finish
  16192, //double standard finish (WHY IS IT LIKE THIS)
  16193, //single technical finish
  16194, //double technical finish
  16195, //triple technical finish
  16196, //quadruple technical finish
  7418, //flamethrower
  16484, //kaeshi higanbana
  16485, //kaeshi goken
  16486, //kaeshi setsugekka
  2259, //ten
  18805,
  2261, //chi
  18806,
  2263, //jin
  18807,
  2265, //fuma shurikan
  18873,
  18874,
  18875,
  2267, //raiton
  18877,
  2266, //katon
  18876,
  2268, //hyoton
  18878,
  16492, //hyosho ranryu
  16471, //goka meykakku
  16491, //goka meykakku (16471 is the PvP version, 16491 is the PvE version)
  2270, //doton
  18880,
  2269, //huton
  18879,
  2271, //suiton
  18881,
  2272, //rabbit medium
])

const ogcdOverrides = new Set([
  3559, //bard WM
  116, //bard AP
  114, //bard MB
  ACTION_IDS.Sprint, // Sprint
])

const actionOverrides = new Map<
  number,
  {
    ActionCategory: any
    Icon: any
    Name: string
  }
>([
  // Sprint's actual api data has an innaccurate icon.
  // https://xivapi.com/Action/3?columns=Icon,Name,ActionCategoryTargetID
  // https://xivapi.com/i/000000/000405.png
  [
    ACTION_IDS.Sprint,
    {
      ActionCategory: { value: 10 },
      Icon: { path: "ui/icon/000000/000104.tex", path_hr1: "ui/icon/000000/000104_hr1.tex" },
      Name: "Sprint",
    },
  ],
])

const actionMap = new Map()

type APIData = {
  ActionCategory: any
  Icon: any
  Name: string
}

type Props = {
  actionId: number
  casting: boolean
  ability: string
  additionalClasses: string
}

export default function Action({
  actionId,
  casting,
  ability,
  additionalClasses,
}: Props) {
  const [apiData, setApiData] = React.useState<APIData>()

  React.useEffect(() => {
    const mapData = actionMap.get(actionId)
    if (mapData != null) {
      setApiData(mapData)
      return
    }

    let current = true
    void (async () => {
      const itemId = getItemId(ability)
      const url =
        itemId == null
          // ? `https://xivapi.com/Action/${actionId}?columns=Icon,Name,ActionCategoryTargetID`
          ? `https://beta.xivapi.com/api/1/sheet/Action/${actionId}?fields=Icon,Name,ActionCategory`
          // : `https://xivapi.com/Item/${itemId}?columns=Name,Icon,IconHD,IconID`
          : `https://beta.xivapi.com/api/1/sheet/Item/${itemId}?fields=Icon,Name`

      const localData = actionOverrides.get(actionId)
      const data =
        localData || (await (await fetch(url, { mode: "cors" })).json()).fields

      if (current) {
        actionMap.set(actionId, data)
        setApiData(data)
      }
    })()

    return () => {
      current = false
    }
  }, [actionId, ability])

  if (apiData === undefined || !apiData.Icon) {
    return null
  }

  const isItem = getIsItem(ability)
  const isGCD =
    !isItem &&
    (gcdOverrides.has(actionId) ||
      (!ogcdOverrides.has(actionId) && apiData.ActionCategory.value !== 4))

  return (
    <img
      className={
        isGCD ? `gcd ${additionalClasses}` : `ogcd ${additionalClasses}`
      }
      style={casting ? { opacity: 0.5 } : undefined}
      // src={`https://xivapi.com/${apiData.Icon}`}
      src={`https://beta.xivapi.com/api/1/asset/${apiData.Icon.path_hr1}?format=png`}
      alt={apiData.Name || ""}
    />
  )
}

function getIsItem(ability: string) {
  const isIt = ability.startsWith("item_")
  return isIt
}

function getItemId(ability: string) {
  const isItem = getIsItem(ability)
  if (!isItem) return null

  const hex = ability.replace("item_", "")
  const bigId = parseInt(hex, 16)
  const itemId = bigId > 1000000 ? bigId - 1000000 : bigId
  return itemId
}
