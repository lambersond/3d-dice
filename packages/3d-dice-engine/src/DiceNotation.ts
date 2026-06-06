export class DiceNotation {
  [key: string]: any

  constructor(notation: any) {
    if (typeof notation === 'object') {
      notation = notation.notation
    }

    this.set = []
    this.setkeys = []
    this.setid = 0
    this.groups = []
    this.totalDice = 0
    this.op = ''
    this.constant = null
    this.result = []
    this.error = false
    this.boost = 1
    this.notation = ''
    this.vectors = []

    if (!notation || notation === '0') {
      this.error = true
    }

    this.parseNotation(notation)
  }

  parseNotation(notation: string) {
    if (notation) {
      const rage = notation.split('!').length - 1 || 0
      if (rage > 0) {
        this.boost = Math.min(Math.max(rage, 0), 3) * 4
      }
      notation = notation.split('!').join('') // remove and continue
      notation = notation.split(' ').join('') // remove spaces

      // count group starts and ends
      const groupstarts = notation.split('(').length - 1
      const groupends = notation.split(')').length - 1
      if (groupstarts !== groupends) this.error = true
    }
    const op = this.notation.length > 0 ? '+' : ''
    this.notation += op + notation

    const no = notation.split('@') // 0: dice notations, 1: forced results
    let notationstring = no[0]
    const rollregex =
      /(\+|\-|\*|\/|\%|\^|){0,1}()(\d*)([a-z]+\d+|[a-z]+|)(?:\{([a-z]+)(.*?|)\}|)()/i

    // rollregex breakdown ("i" = case-insensitive):
    //   1: ([+\-*/%^]{0,1})         optional math operator for the group
    //   3: (\d*)                    number of dice
    //   4: ([a-z]+\d+|[a-z]+|)      the die type
    //   5/6: \{([a-z]+)(.*?|)\}     roll functions, e.g. "{r,2}" = reroll all 2s
    // predetermined results follow "@" (parsed separately below), e.g. "@4,4,4"

    const resultsregex = /(\b)*(\-\d+|\d+)(\b)*/gi // forced results: '1, 2, 3' or '1 2 3'
    let res

    let runs = 0
    const breaklimit = 30
    let groupLevel = 0
    let groupID = 0
    while (
      !this.error &&
      notationstring.length > 0 &&
      (res = rollregex.exec(notationstring)) !== null &&
      runs < breaklimit
    ) {
      runs++

      // remove this notation so we can move on next iteration
      notationstring = notationstring.substring(res[0].length)

      const operator = res[1]
      const groupstart = res[2] && res[2].length > 0
      let amount: any = res[3]
      let type = res[4]
      const funcname = res[5] || ''
      let funcargs: any = res[6] || ''
      const groupend = res[7] && res[7].length > 0
      let addset = true

      // individual groups get a unique id so two separate groups at the same
      // level don't get combined later
      if (groupstart) {
        groupLevel += res[2].length
      }

      // arguments come in with a leading comma (','), so split and drop the
      // first blank entry
      funcargs = funcargs.split(',')
      if (!funcargs || funcargs.length < 1) funcargs = '' // sanity
      funcargs.shift()

      // a lone operator+constant as the whole string (e.g. '+7', '*4', '-2') —
      // assume a d20 is to be rolled
      if (runs === 1 && notationstring.length === 0 && !type && operator && amount) {
        type = 'd20'
        this.op = operator
        this.constant = parseInt(amount)
        amount = 1

        // otherwise this is a trailing operator+constant on a multi-set roll
      } else if (runs > 1 && notationstring.length === 0 && !type) {
        this.op = operator
        this.constant = parseInt(amount)
        addset = false
      }

      if (addset) {
        this.addSet(amount, type, groupID, groupLevel, funcname, funcargs, operator)
      }

      if (groupend) {
        groupLevel -= res[7].length
        groupID += res[7].length
      }
    }

    // forced results
    if (!this.error && no[1] && (res = no[1].match(resultsregex)) !== null) {
      this.result.push(...res)
    }
  }

  stringify(full = true) {
    let output = ''

    if (this.set.length < 1) return output

    for (let i = 0; i < this.set.length; i++) {
      const set = this.set[i]

      output += i > 0 && set.op ? set.op : ''
      output += set.num + set.type
      if (set.func) {
        output += '{'
        output += set.func ? set.func : ''
        output += set.args
          ? ',' + (Array.isArray(set.args) ? set.args.join(',') : set.args)
          : ''
        output += '}'
      }
    }

    output += this.constant ? this.op + '' + Math.abs(this.constant) : ''

    if (full && this.result && this.result.length > 0) {
      output += '@' + this.result.join(',')
    }

    if (this.boost > 1) {
      output += '!'.repeat(this.boost / 4)
    }
    return output
  }

  addSet(
    amount: any,
    type: any,
    groupID = 0,
    groupLevel = 0,
    funcname = '',
    funcargs: any = '',
    operator = '+',
  ) {
    amount = Math.abs(Number.parseInt(amount || 1))

    // update a previous set if these match — also combines duplicates
    const setkey = `${operator}${type}${groupID}${groupLevel}${funcname}${funcargs}`
    const update = this.setkeys[setkey] != null

    let setentry: any = {}
    if (update) {
      setentry = this.set[this.setkeys[setkey] - 1]
    }

    if (amount > 0) {
      setentry.num = update ? amount + setentry.num : amount
      setentry.type = type
      setentry.sid = this.setid
      setentry.gid = groupID
      setentry.glvl = groupLevel
      if (funcname) setentry.func = funcname
      if (funcargs) setentry.args = funcargs
      if (operator) setentry.op = operator

      if (update) {
        this.set[this.setkeys[setkey] - 1] = setentry
      } else {
        this.setkeys[setkey] = this.set.push(setentry)
      }
    }

    if (!update) ++this.setid
  }

  static mergeNotation(prevNotation: any, newNotation: any) {
    // let our vectors combine
    return {
      ...prevNotation,
      constant: prevNotation.constant + newNotation.constant,
      notation: prevNotation.notation + '+' + newNotation.notation,
      set: [...prevNotation.set, ...newNotation.set],
      totalDice: prevNotation.vectors.length + newNotation.vectors.length,
      vectors: [...prevNotation.vectors, ...newNotation.vectors],
    }
  }
}
