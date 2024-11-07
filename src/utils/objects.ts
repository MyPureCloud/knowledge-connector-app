import _ from 'lodash';

export function setIfMissing<I extends object, O>(
  obj: I,
  path: string,
  value: O,
): O {
  if (!_.has(obj, path)) {
    _.set(obj, path, value);
  }
  return _.get(obj, path);
}
