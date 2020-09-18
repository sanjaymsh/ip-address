import { BigInteger } from 'jsbn';
import { sprintf } from 'sprintf-js';

import padStart from 'lodash.padstart';
import repeat from 'lodash.repeat';

import * as common from './common';
import * as constants from './v4/constants';

/**
 * Represents an IPv4 address
 * @class Address4
 * @param {string} address - An IPv4 address string
 */
export class Address4 {
  address: string;
  addressMinusSuffix?: string;
  error?: string;
  groups: number = constants.GROUPS;
  parsedAddress: string[] = [];
  parsedSubnet: string = '';
  subnet: string = '/32';
  subnetMask: number = 32;
  v4: boolean = true;
  valid: boolean = false;

  constructor(address: string) {
    this.address = address;

    var subnet = constants.RE_SUBNET_STRING.exec(address);

    if (subnet) {
      this.parsedSubnet = subnet[0].replace('/', '');
      this.subnetMask = parseInt(this.parsedSubnet, 10);
      this.subnet = '/' + this.subnetMask;

      if (this.subnetMask < 0 || this.subnetMask > constants.BITS) {
        this.valid = false;
        this.error = 'Invalid subnet mask.';

        return;
      }

      address = address.replace(constants.RE_SUBNET_STRING, '');
    }

    this.addressMinusSuffix = address;

    this.parsedAddress = this.parse(address);
  }

  /*
   * Parses a v4 address
   */
  parse(address: string) {
    var groups = address.split('.');

    if (address.match(constants.RE_ADDRESS)) {
      this.valid = true;
    } else {
      this.error = 'Invalid IPv4 address.';
    }

    return groups;
  };

  /**
   * Return true if the address is valid
   * @memberof Address4
   * @instance
   * @returns {Boolean}
   */
  isValid(): boolean {
    return this.valid;
  };

  /**
   * Returns the correct form of an address
   * @memberof Address4
   * @instance
   * @returns {String}
   */
  correctForm() {
    return this.parsedAddress.map(function (part) {
      return parseInt(part, 10);
    }).join('.');
  };

  /**
   * Returns true if the address is correct, false otherwise
   * @memberof Address4
   * @instance
   * @returns {Boolean}
   */
  isCorrect = common.isCorrect(constants.BITS);

  /**
   * Converts a hex string to an IPv4 address object
   * @memberof Address4
   * @static
   * @param {string} hex - a hex string to convert
   * @returns {Address4}
   */
  static fromHex(hex: string) {
    var padded = padStart(hex.replace(/:/g, ''), 8, '0');
    var groups = [];
    var i;

    for (i = 0; i < 8; i += 2) {
      var h = padded.slice(i, i + 2);

      groups.push(parseInt(h, 16));
    }

    return new Address4(groups.join('.'));
  };

  /**
   * Converts an integer into a IPv4 address object
   * @memberof Address4
   * @static
   * @param {integer} integer - a number to convert
   * @returns {Address4}
   */
  static fromInteger(integer: number) {
    return Address4.fromHex(integer.toString(16));
  };

  /**
   * Converts an IPv4 address object to a hex string
   * @memberof Address4
   * @instance
   * @returns {String}
   */
  toHex(): string {
    return this.parsedAddress.map(function (part) {
      return sprintf('%02x', parseInt(part, 10));
    }).join(':');
  };

  /**
   * Converts an IPv4 address object to an array of bytes
   * @memberof Address4
   * @instance
   * @returns {Array}
   */
  toArray(): number[] {
    return this.parsedAddress.map(function (part) {
      return parseInt(part, 10);
    });
  };

  /**
   * Converts an IPv4 address object to an IPv6 address group
   * @memberof Address4
   * @instance
   * @returns {String}
   */
  toGroup6(): string {
    var output = [];
    var i;

    for (i = 0; i < constants.GROUPS; i += 2) {
      var hex = sprintf('%02x%02x',
        parseInt(this.parsedAddress[i], 10),
        parseInt(this.parsedAddress[i + 1], 10));

      output.push(sprintf('%x', parseInt(hex, 16)));
    }

    return output.join(':');
  };

  /**
   * Returns the address as a BigInteger
   * @memberof Address4
   * @instance
   * @returns {BigInteger}
   */
  bigInteger(): BigInteger | null {
    if (!this.valid) {
      return null;
    }

    return new BigInteger(this.parsedAddress.map(function (n) {
      return sprintf('%02x', parseInt(n, 10));
    }).join(''), 16);
  };

  /**
   * Helper function getting start address.
   * @memberof Address4
   * @instance
   * @returns {BigInteger}
   */
  _startAddress(): BigInteger {
    return new BigInteger(
      this.mask() + repeat('0', constants.BITS - this.subnetMask), 2
    );
  };

  /**
   * The first address in the range given by this address' subnet.
   * Often referred to as the Network Address.
   * @memberof Address4
   * @instance
   * @returns {Address4}
   */
  startAddress() {
    return Address4.fromBigInteger(this._startAddress());
  };

  /**
   * The first host address in the range given by this address's subnet ie
   * the first address after the Network Address
   * @memberof Address4
   * @instance
   * @returns {Address4}
   */
  startAddressExclusive() {
    var adjust = new BigInteger('1');
    return Address4.fromBigInteger(this._startAddress().add(adjust));
  };

  /**
   * Helper function getting end address.
   * @memberof Address4
   * @instance
   * @returns {BigInteger}
   */
  _endAddress() {
    return new BigInteger(
      this.mask() + repeat('1', constants.BITS - this.subnetMask), 2
    );
  };

  /**
   * The last address in the range given by this address' subnet
   * Often referred to as the Broadcast
   * @memberof Address4
   * @instance
   * @returns {Address4}
   */
  endAddress() {
    return Address4.fromBigInteger(this._endAddress());
  };

  /**
   * The last host address in the range given by this address's subnet ie
   * the last address prior to the Broadcast Address
   * @memberof Address4
   * @instance
   * @returns {Address4}
   */
  endAddressExclusive() {
    var adjust = new BigInteger('1');
    return Address4.fromBigInteger(this._endAddress().subtract(adjust));
  };

  /**
   * Converts a BigInteger to a v4 address object
   * @memberof Address4
   * @static
   * @param {BigInteger} bigInteger - a BigInteger to convert
   * @returns {Address4}
   */
  static fromBigInteger(bigInteger: BigInteger) {
    return Address4.fromInteger(parseInt(bigInteger.toString(), 10));
  };

  /**
   * Returns the first n bits of the address, defaulting to the
   * subnet mask
   * @memberof Address4
   * @instance
   * @returns {String}
   */
  mask(mask?: number): string {
    if (mask === undefined) {
      mask = this.subnetMask;
    }

    return this.getBitsBase2(0, mask);
  };

  /**
   * Returns the bits in the given range as a base-2 string
   * @memberof Address4
   * @instance
   * @returns {string}
   */
  getBitsBase2(start: number, end: number): string {
    return this.binaryZeroPad().slice(start, end);
  };

  /**
   * Returns true if the given address is in the subnet of the current address
   * @memberof Address4
   * @instance
   * @returns {boolean}
   */
  isInSubnet = common.isInSubnet;

  /**
   * Returns true if the given address is a multicast address
   * @memberof Address4
   * @instance
   * @returns {boolean}
   */
  isMulticast() {
    return this.isInSubnet(new Address4('224.0.0.0/4'));
  };

  /**
   * Returns a zero-padded base-2 string representation of the address
   * @memberof Address4
   * @instance
   * @returns {string}
   */
  binaryZeroPad() {
    return padStart(this.bigInteger().toString(2), constants.BITS, '0');
  };
}