import {
  oddsTypeFilters, ODDSTYPES,
  THREEWAY_ITERATOR, TWOWAY_ITERATOR,
  BASELINE_BOOKMAKER,
  calculateKelly,
  crossoverAsianEuropean
} from './helpers'
import _ from 'underscore'

const KELLY_THRESHOLD = 0.01

export function groupOffers(offers) {
  return _
    .chain(offers)
    .groupBy(offer => offer.odds.o3)
    .value()
}

export function computeEdges(groups) {
  let edges = {}
  for (let group of groups.values()) {
    for (let f of oddsTypeFilters) {
      let subOffers = group.odds.filter(f)
      if (subOffers.length > 1) {
        switch(subOffers[0].oddsType) {
          case ODDSTYPES.threeway:
            Object.assign(edges, findThreewayEdges(group.match, subOffers))
            break
          case ODDSTYPES.moneyline:
          case ODDSTYPES.dnb:
            Object.assign(edges, findTwowayEdges(group.match, subOffers))
            break
          default:
            let subgroups = groupOffers(subOffers)
            for (let line in subgroups) {
              if (subgroups[line].length > 1) {
                Object.assign(edges, findTwowayEdges(group.match, subgroups[line]))
              }
            }
            break
        }
      }
    }
    let subGroup = group.odds.filter(crossoverAsianEuropean)
    if (subGroup.length <= 1)
      continue
    const { match } = group
    subGroup.filter(o => o.bookmaker === BASELINE_BOOKMAKER).forEach(baselineOffer => {
      ['o1', 'o2'].forEach((output, i) => {
        let europeanOutput = i === 0 ? 'o1' : 'o3'
        let baseline = baselineOffer.odds[output] / (1 / (1 / baselineOffer.odds.o1 + 1 / baselineOffer.odds.o2))
        let europeanCondition = i === 0 ? baselineOffer.odds.o3 + 0.5 : baselineOffer.odds.o3 - 0.5
        subGroup.filter(o => o.odds.o4 === europeanCondition).forEach(offer => {
          const edge = Math.round(((offer.odds[europeanOutput] / baseline) - 1) * 100 * 10) / 10
          const kelly = calculateKelly(offer.odds[europeanOutput], baseline)
          if (edge >= 0.5 && edge < 40) {
            const edgeId = offer._id + '_' + europeanOutput
            edges[edgeId] = {
              _id: edgeId,
              offer: offer._id,
              edge,
              bookmaker: offer.bookmaker,
              oddsType: offer.oddsType,
              matchId: match._id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              competition: {
                uid: match.competition._id,
                name: match.competition.name
              },
              startTime: match.startTime,
              sportId: match.sportId,
              country: match.country,
              output: europeanOutput,
              odds: offer.odds[europeanOutput],
              oddsTypeCondition: offer.odds.o4,
              yardstick: baseline,
              baselineOffer: baselineOffer._id,
              kelly
            }
          }
        })
      })
    })
  }
  return edges
}

export function findThreewayEdges(match, offers) {
  let edges = {}
  for (let output of THREEWAY_ITERATOR) {
    offers.sort((a, b) => {
      return b.odds[output] - a.odds[output]
    })
    for (let i = 0; i < offers.length; i++) {
      if (offers[i].bookmaker === BASELINE_BOOKMAKER) {
        const baseline = Math.round(offers[i].odds[output] / ( 1 / (
                          1 / offers[i].odds.o1 +
                          1 / offers[i].odds.o2 +
                          1 / offers[i].odds.o3)
                          ) * 1000) / 1000
        for (let j = 0; j < i; j++) {
          const edge = Math.round(((offers[j].odds[output] / baseline) - 1) * 100 * 10) / 10
          const kelly = calculateKelly(offers[j].odds[output], baseline)
          if (edge >= 0.5 && edge < 40) {
            const edgeId = offers[j]._id + '_' + output
            edges[edgeId] = {
              _id: edgeId,
              offer: offers[j]._id,
              edge: Math.round(edge * 100) / 100,
              bookmaker: offers[j].bookmaker,
              oddsType: offers[j].oddsType,
              matchId: match._id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              competition: {
                uid: match.competition._id,
                name: match.competition.name
              },
              startTime: match.startTime,
              sportId: match.sportId,
              country: match.country,
              output: output,
              odds: offers[j].odds[output],
              yardstick: baseline,
              baselineOffer: offers[i]._id,
              kelly
            }
          } else {
            break // If this one is not an edge, the next ones aren't either
          }
        }
        break // No reason to continue after we've hit the baselinebookie
      }
    }
  }
  return edges
}

export function findTwowayEdges(match, offers) {
  let edges = {}
  for (let output of TWOWAY_ITERATOR) {
    offers.sort((a, b) => {
      return b.odds[output] - a.odds[output]
    })
    for (let i = 0; i < offers.length; i++) {
      if (offers[i].bookmaker === BASELINE_BOOKMAKER) {
        const baseline = Math.round(offers[i].odds[output] / ( 1 / (
                          1 / offers[i].odds.o1 +
                          1 / offers[i].odds.o2)
                          ) * 1000) / 1000
        for (let j = 0; j <= i; j++) {
          const edge = Math.round(((offers[j].odds[output] / baseline) - 1) * 100 * 10) / 10
          const kelly = calculateKelly(offers[j].odds[output], baseline)
          if (edge >= 0.5 && edge < 40) {
            const edgeId = offers[j]._id + '_' + output
            edges[edgeId] = {
              _id: edgeId,
              offer: offers[j]._id,
              edge: edge,
              odds: offers[j].odds[output],
              bookmaker: offers[j].bookmaker,
              oddsType: offers[j].oddsType,
              matchId: match._id,
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              startTime: match.startTime,
              competition: {
                uid: match.competition._id,
                name: match.competition.name
              },
              sportId: match.sportId,
              country: match.country,
              output: output,
              oddsTypeCondition: offers[j].odds.o3,
              yardstick: baseline,
              baselineOffer: offers[i]._id,
              kelly
            }
          } else {
            break // If this one is not an edge, the next ones aren't either
          }
        }
        break // No reason to continue after we've hit the baselinebookie
      }
    }
  }
  return edges
}
