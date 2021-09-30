// Copyright 2021 Proyectos y Sistemas de Mantenimiento SL (eProsima).
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const fs = require('fs')

module.exports = JSONBackup;

/**
 * IUnknown interface
 *
 * @param {Object} object to guard 
 */
function IUnknown(manager)
{
    this.manager = manager;
    this.reference_counter = 0;

}

IUnknown.prototype.AddRef = function()
{
    if( this.reference_counter == 0 )
    {
        // Load File into memory
        this.manager._load_file();
    }

    this.reference_counter++;
}

IUnknown.prototype.Release = function()
{
    if( this.reference_counter > 0 )
    {
        if( this.reference_counter == 1 )
        {
            // Backup memory into file
            this.manager._store_file();
        }

        this.reference_counter--;
    }
}

/**
 * Collection object
 *
 * @param {Object} collection manager
 */
function Collection(manager) {
    this.manager = manager;
    this.elements = new Map();
    this._collection_json = "";
}

Collection.prototype.serialize = function()
{
    let data = JSON.stringify(Array.from(this.elements.entries()));
    // ignore if there are no changes
    if ( data == this._collection_json )
    {
        return null;
    }

    return data;
}

Collection.prototype.deserialize = function(file_data)
{
    try
    {
        this._collection_json = file_data;
        this.elements = new Map(JSON.parse(file_data));
    }
    catch(err)
    {
        this._collection_json = "";
        this.elements = new Map();
    }
}

Collection.prototype.add = function(newbye)
{
    // choose a new id as key
    let id = 0;
    if ( this.elements.size > 0 )
    {
        id = Math.max(... this.elements.keys());
    }

    // Add the new element
    this.elements.set(++id, newbye);
}

Collection.prototype.remove = function(id)
{
    // remove the element
    return this.elements.delete(parseInt(id));
}

Collection.prototype.get = function(id)
{
    // retrieve an element
    return this.elements.get(parseInt(id));
}

Collection.prototype.find = function(test)
{
    let iterator = this.elements.entries();
    let entry = null;

    do
    {
        entry = iterator.next();

        if (!entry.done && test(entry.value[1]) )
        {
            return entry.value[0];
        }

    }
    while (!entry.done)

    return null;
}

Collection.prototype.next_id = function(id)
{
    let iterator = this.elements.keys();

    if( id == null)
    {
        // return the first id
        return iterator.next().value;
    }
    else
    {
        let entry = null;

        do
        {
            entry = iterator.next();
            if (!entry.done && entry.value > id)
            {
                return entry.value;
            }
        }
        while(!entry.done)
    }

    return null;
}

/**
 * Construct an object that can handle JSON backup file
 *
 * @param {Object} filepath
 */
function JSONBackup (filepath) {

    this._user_file = filepath;
    this._collection = new Collection(this);
    this._ref_counter = new IUnknown(this); 
}

JSONBackup.prototype._load_file = function()
{
    let file_data = "";

    try
    {
        file_data = fs.readFileSync(this._user_file).toString();
    }
    catch(err) { }

    this._collection.deserialize(file_data);

}

JSONBackup.prototype._store_file = function()
{
    let file_data = this._collection.serialize();
    // write only if changes are present
    if ( file_data != null )
    {
        fs.writeFileSync(this._user_file, file_data);       
    }
}    

/**
 * Add a new element, the id will be assigned automatically
 *
 * @param {Object} object to add 
 */
JSONBackup.prototype.add_element = function(newbye)
{
    this._ref_counter.AddRef();
    try {
        this._collection.add(newbye);
    }
    finally {
        this._ref_counter.Release();
    }
}

/**
 * remove an element
 *
 * @param {Object} element's id
 */
JSONBackup.prototype.remove_element = function(id)
{
    this._ref_counter.AddRef();
    try {
        this._collection.remove(id);
    }
    finally {
        this._ref_counter.Release();
    }
}

/**
 * get an element
 *
 * @param {Object} element's id
 * @param {Object} functor to apply as functor(error, element)
 * @result functor result
 */
JSONBackup.prototype.get_element = function(id, done)
{
    this._ref_counter.AddRef();
    try {
        let element = this._collection.get(id);
        if (element != null)
        {
            return done(null, element);
        }
        else
        {
            return done(new Error('Element Not Found'));
        }
    }
    finally {
        this._ref_counter.Release();
    }
}

/**
 * finds the first element that maches a criteria
 *
 * @param {function} test 
 * @result matching element id or null
 */
JSONBackup.prototype.find_element = function(test)
{
    this._ref_counter.AddRef();

    try {
        return this._collection.find(test);
    }
    finally {
        this._ref_counter.Release();
    }

    return null;
}

/**
 * Returns the index that succeeds the given one
 *
 * @param {number} id index
 * @result The next index value or the first one if id is null
 */
JSONBackup.prototype.next_id = function(id)
{
    this._ref_counter.AddRef();

    try {
        return this._collection.next_id(id);
    }
    finally {
        this._ref_counter.Release();
    }

    return null;
}
